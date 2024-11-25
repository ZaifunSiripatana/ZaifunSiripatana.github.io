import json
import os
from datetime import datetime
from io import BytesIO

import numpy as np
import tensorflow as tf
from flask import (Flask, jsonify, redirect, render_template, request,
                  send_from_directory, url_for)
from tensorflow.keras.preprocessing import image
from werkzeug.utils import secure_filename

# Initialize Flask app
app = Flask(__name__, static_folder='static')

# Add context processor for templates
@app.context_processor
def inject_now():
    return {'now': datetime.now()}

# Configuration
app.config.update(
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max file size
    UPLOAD_FOLDER=os.path.join('static', 'img', 'uploads'),
    SECRET_KEY='your-secret-key-here',  # Change this in production
    DEBUG=True  # Set to False in production
)

# Constants
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MODEL_PATH = os.path.join('model', 'WormEggs_classification.h5')
PARASITE_INFO_PATH = os.path.join('data', 'parasite_info.json')

def init_app():
    """Initialize application directories and check permissions."""
    directories = [
        app.static_folder,
        os.path.join(app.static_folder, 'css'),
        os.path.join(app.static_folder, 'js'),
        os.path.join(app.static_folder, 'img'),
        app.config['UPLOAD_FOLDER']
    ]
    
    for directory in directories:
        try:
            os.makedirs(directory, exist_ok=True)
            # Test write permissions
            test_file = os.path.join(directory, '.test')
            with open(test_file, 'w') as f:
                f.write('test')
            os.remove(test_file)
        except Exception as e:
            print(f"Error creating/accessing directory {directory}: {e}")
            raise

# Initialize application directories
init_app()

# Load ML model
try:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH)
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

# Load parasite information
try:
    with open(PARASITE_INFO_PATH, 'r', encoding='utf-8') as f:
        parasite_info = json.load(f)
except Exception as e:
    print(f"Error loading parasite info: {e}")
    parasite_info = {}

def cleanup_old_files(hours=24):
    """Remove files older than specified hours."""
    upload_dir = app.config['UPLOAD_FOLDER']
    current_time = datetime.now()
    
    for filename in os.listdir(upload_dir):
        if filename.startswith('.'): # Skip hidden files
            continue
            
        filepath = os.path.join(upload_dir, filename)
        file_time = datetime.fromtimestamp(os.path.getctime(filepath))
        
        if (current_time - file_time).total_seconds() > hours * 3600:
            try:
                os.remove(filepath)
                app.logger.info(f"Removed old file: {filename}")
            except Exception as e:
                app.logger.error(f"Error removing old file {filepath}: {e}")

def allowed_file(filename):
    """Check if the filename has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def prepare_image(file):
    """Prepare image for prediction."""
    try:
        # Read file into BytesIO object
        file_bytes = BytesIO(file.read())
        file.seek(0)  # Reset file pointer
        
        # Load and preprocess image
        img = image.load_img(file_bytes, target_size=(224, 224))
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) / 255.0
        
        return img_array, file_bytes
    except Exception as e:
        raise ValueError(f"Error preparing image: {str(e)}")

def save_uploaded_file(file, file_bytes=None):
    """Save uploaded file and return filename."""
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = secure_filename(f"{timestamp}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if file_bytes:
            file_bytes.seek(0)
            with open(filepath, 'wb') as f:
                f.write(file_bytes.getvalue())
        else:
            file.save(filepath)
            
        return filename
    except Exception as e:
        raise ValueError(f"Error saving file: {str(e)}")

# Routes
@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Handle image upload and prediction."""
    # Check if model is loaded
    if not model:
        return jsonify({'error': 'Model not initialized'}), 500

    # Cleanup old files
    cleanup_old_files()

    # Check file existence
    if 'file' not in request.files:
        return jsonify({'error': 'ไม่พบไฟล์ที่อัพโหลด'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'ไม่ได้เลือกไฟล์'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'ไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ภาพ jpg, jpeg หรือ png'}), 400

    try:
        # Prepare image
        img_array, file_bytes = prepare_image(file)
        
        # Make prediction
        predictions = model.predict(img_array)
        predicted_index = np.argmax(predictions, axis=1)[0]
        predicted_class = list(parasite_info.keys())[predicted_index]
        confidence = float(np.max(predictions))

        # Save file
        filename = save_uploaded_file(file, file_bytes)

        # Get result
        result = {
            'success': True,
            'prediction': predicted_class,
            'confidence': confidence,
            'image_path': os.path.join('img', 'uploads', filename),
            **parasite_info[predicted_class]
        }

        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Prediction error: {str(e)}")
        return jsonify({'error': f'เกิดข้อผิดพลาด: {str(e)}'}), 500

@app.route('/result')
def result():
    """Render the result page."""
    try:
        # Get parameters from URL
        prediction = request.args.get('prediction')
        confidence = float(request.args.get('confidence', 0))
        image_path = request.args.get('image_path')

        # Validate prediction class
        if prediction not in parasite_info:
            raise ValueError('Invalid prediction class')

        # Render template with all data
        return render_template(
            'result.html',
            prediction=prediction,
            confidence=confidence,
            image_path=image_path,
            **parasite_info[prediction]
        )
    except Exception as e:
        app.logger.error(f"Error rendering result: {str(e)}")
        return render_template('error.html', error=str(e))

@app.route('/about')
def about():
    """Render the about page."""
    return render_template('about.html')

@app.route('/help')
def help():
    """Render the help page."""
    return render_template('help.html')

@app.route('/favicon.ico')
def favicon():
    """Serve the favicon."""
    return send_from_directory(app.static_folder,
                             'favicon.ico',
                             mimetype='image/vnd.microsoft.icon')

# Error handlers
@app.errorhandler(404)
def page_not_found(e):
    """Handle 404 errors."""
    return render_template('error.html', 
                         error='ไม่พบหน้าที่คุณต้องการ',
                         description='URL ที่คุณพยายามเข้าถึงไม่มีอยู่ในระบบ'), 404

@app.errorhandler(500)
def internal_server_error(e):
    """Handle 500 errors."""
    return render_template('error.html',
                         error='เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
                         description='กรุณาลองใหม่อีกครั้งในภายหลัง'), 500

if __name__ == '__main__':
    app.run(debug=True)
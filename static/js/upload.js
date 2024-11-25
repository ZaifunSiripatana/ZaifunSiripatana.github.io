document.addEventListener('DOMContentLoaded', function() {
    // Debug mode
    const DEBUG = true;
    function debug(...args) {
        if (DEBUG) console.log(...args);
    }

    // Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const removeBtn = document.getElementById('remove-btn');
    const analyzeBtn = document.getElementById('analyze-btn');

    debug('Elements loaded:', { dropZone, fileInput, previewContainer, previewImage, removeBtn, analyzeBtn });

    // Initialize
    if (dropZone && fileInput) {
        // Click to upload
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            debug('File input change:', e);
            handleFiles(e);
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('highlight');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('highlight');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('highlight');
            const files = e.dataTransfer.files;
            handleFiles({ target: { files: files } });
        });
    }

    // Remove button
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (previewContainer) previewContainer.style.display = 'none';
            if (dropZone) dropZone.style.display = 'block';
            if (analyzeBtn) analyzeBtn.disabled = true;
            debug('File removed');
        });
    }

    // File handling
    function handleFiles(e) {
        const file = e.target.files[0];
        debug('Handling file:', file);

        if (file && isValidFile(file)) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                debug('File reader loaded:', e);
                if (previewImage) previewImage.src = e.target.result;
                if (previewContainer) previewContainer.style.display = 'block';
                if (dropZone) dropZone.style.display = 'none';
                if (analyzeBtn) analyzeBtn.disabled = false;
            };

            reader.onerror = function(e) {
                debug('File reader error:', e);
                alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
            };

            reader.readAsDataURL(file);
        }
    }

    function isValidFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            alert('กรุณาอัพโหลดไฟล์ภาพ JPG, JPEG หรือ PNG เท่านั้น');
            return false;
        }
        if (file.size > 16 * 1024 * 1024) {
            alert('ขนาดไฟล์ต้องไม่เกิน 16MB');
            return false;
        }
        return true;
    }

    // Analyze button
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            if (!fileInput || !fileInput.files[0]) return;

            try {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);

                const response = await fetch('/predict', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                debug('Prediction response:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                // Redirect to result page
                window.location.href = `/result?${new URLSearchParams({
                    prediction: data.prediction,
                    confidence: data.confidence,
                    image_path: data.image_path
                }).toString()}`;

            } catch (error) {
                debug('Error during analysis:', error);
                alert(`เกิดข้อผิดพลาด: ${error.message}`);
            }
        });
    }
});
document.addEventListener('DOMContentLoaded', function() {
    // Debug flag
    const DEBUG = true;
    function debug(...args) {
        if (DEBUG) console.log(...args);
    }

    debug('Main.js loaded');

    // Element Selection
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const removeBtn = document.getElementById('remove-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    debug('Elements selected:', {
        dropZone,
        fileInput,
        previewContainer,
        previewImage,
        removeBtn,
        analyzeBtn,
        loadingOverlay
    });

    // Initialize UI
    if (analyzeBtn) analyzeBtn.disabled = true;
    if (loadingOverlay) loadingOverlay.style.display = 'none';

    // Drag and Drop Handling
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        dropZone.addEventListener('drop', handleDrop);
        dropZone.addEventListener('click', () => fileInput.click());
    }

    // File Input Handling
    if (fileInput) {
        fileInput.addEventListener('change', handleFiles);
    }

    // Remove Button Handling
    if (removeBtn) {
        removeBtn.addEventListener('click', removeFile);
    }

    // Analyze Button Handling
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzeImage);
    }

    // Utility Functions
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropZone.classList.add('highlight');
    }

    function unhighlight() {
        dropZone.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files: files } });
    }

    function handleFiles(e) {
        const file = e.target.files[0];
        debug('File selected:', file);

        if (file && isValidFile(file)) {
            showPreview(file);
            if (analyzeBtn) analyzeBtn.disabled = false;
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

    function showPreview(file) {
        if (previewImage && previewContainer && dropZone) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                previewContainer.style.display = 'block';
                dropZone.style.display = 'none';
            }
            reader.readAsDataURL(file);
            debug('Preview shown');
        }
    }

    function removeFile() {
        if (fileInput) fileInput.value = '';
        if (previewContainer) previewContainer.style.display = 'none';
        if (dropZone) dropZone.style.display = 'block';
        if (analyzeBtn) analyzeBtn.disabled = true;
        debug('File removed');
    }

    async function analyzeImage() {
        if (!fileInput || !fileInput.files[0]) return;

        try {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }

            debug('Starting analysis');
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            debug('Analysis response:', data);

            if (!response.ok) {
                throw new Error(data.error || 'เกิดข้อผิดพลาดในการวิเคราะห์');
            }

            // Redirect to result page with data
            window.location.href = `/result?${new URLSearchParams({
                prediction: data.prediction,
                confidence: data.confidence,
                image_path: data.image_path
            }).toString()}`;

        } catch (error) {
            debug('Analysis error:', error);
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }
    }
});
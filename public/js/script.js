document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const fileDetails = document.getElementById('fileDetails');
    const fileName = document.getElementById('fileName');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const downloadBtn = document.getElementById('downloadBtn');
    const viewBtn = document.getElementById('viewBtn');
    const errorDiv = document.getElementById('error');
    const jsonViewer = document.getElementById('jsonViewer');
    const jsonContent = document.getElementById('jsonContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    
    let selectedFile = null;
    let convertedJson = null;
    
    // Prevent default behavior for drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when file is dragged over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length) {
            handleFiles(files);
        }
    }
    
    // Handle file selection from input
    fileInput.addEventListener('change', function() {
        if (fileInput.files.length) {
            handleFiles(fileInput.files);
        }
    });
    
    function handleFiles(files) {
        if (files[0].type !== 'text/csv') {
            showError('Please select a CSV file.');
            return;
        }
        
        selectedFile = files[0];
        fileName.textContent = selectedFile.name;
        fileDetails.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        result.classList.add('hidden');
    }
    
    // Clear selection
    clearBtn.addEventListener('click', function() {
        clearSelection();
    });
    
    function clearSelection() {
        selectedFile = null;
        fileInput.value = '';
        fileDetails.classList.add('hidden');
        result.classList.add('hidden');
        errorDiv.classList.add('hidden');
        jsonViewer.classList.add('hidden');
    }
    
    // Convert CSV to JSON
    convertBtn.addEventListener('click', function() {
        if (!selectedFile) {
            showError('Please select a CSV file first.');
            return;
        }
        
        startConversion();
    });
    
    function startConversion() {
        loading.classList.remove('hidden');
        result.classList.add('hidden');
        errorDiv.classList.add('hidden');
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        fetch('/api/convert-csv', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Error converting file');
                });
            }
            return response.json();
        })
        .then(data => {
            convertedJson = data;
            loading.classList.add('hidden');
            result.classList.remove('hidden');
        })
        .catch(error => {
            loading.classList.add('hidden');
            showError(error.message);
        });
    }
    
    // Download JSON
    downloadBtn.addEventListener('click', function() {
        if (!convertedJson) return;
        
        const blob = new Blob([JSON.stringify(convertedJson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.name.replace('.csv', '.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    // View JSON
    viewBtn.addEventListener('click', function() {
        if (!convertedJson) return;
        
        jsonContent.textContent = JSON.stringify(convertedJson, null, 2);
        jsonViewer.classList.remove('hidden');
    });
    
    // Close JSON viewer
    closeViewerBtn.addEventListener('click', function() {
        jsonViewer.classList.add('hidden');
    });
    
    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
});

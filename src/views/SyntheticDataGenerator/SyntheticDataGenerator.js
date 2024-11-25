import React, { useState } from 'react';
import './SyntheticDataGenerator.css';
import { ipcRenderer } from 'electron';

const SyntheticDataGenerator = () => {
    const [file, setFile] = useState(null);
    const [rowCount, setRowCount] = useState(''); // State for the number of rows
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [syntheticData, setSyntheticData] = useState(null);

    const handleFileChange = (event) => {
        setFile(event.target.files[0]);
        setError('');
        setSuccessMessage('');
    };

    const handleRowCountChange = (event) => {
        setRowCount(event.target.value);
    };

    const handleGenerateSyntheticData = () => {
        if (!file) {
            setError('Please upload a training data file.');
            return;
        }

        if (rowCount && isNaN(rowCount)) {
            setError('Number of rows must be a valid number.');
            return;
        }
        setError('');
        setSuccessMessage('');
        setSyntheticData(null)
        setLoading(true);
        const filePath = file.path; // File path to send to the backend

        // Send the file path and row count to Electron via ipcRenderer
        ipcRenderer.send('run-synthetic-data-generator', { filePath, rowCount: rowCount || null });

        ipcRenderer.once('generate-synthetic-data', (event, response) => {
            setLoading(false);

            if (response.startsWith('Error:')) {
                setError(response);
                return;
            }

            try {
                const generatedData = JSON.parse(response);
                setSyntheticData(generatedData);
                setSuccessMessage('Synthetic data generated successfully!');
            } catch (e) {
                setError('Error parsing synthetic data response.');
            }
        });
    };

    const handleDownload = () => {
        if (!syntheticData) {
            setError('No synthetic data available to download.');
            return;
        }

        // Create a blob from the synthetic data and create a downloadable link
        const blob = new Blob([JSON.stringify(syntheticData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create a temporary anchor element to trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'synthetic_data.json'; // Name of the downloaded file
        a.click();

        // Revoke the object URL after the download is triggered
        URL.revokeObjectURL(url);
    };

    return (
        <div className="synthetic-data-generator">
            <h3>Tabular Synthetic Data Generator</h3>
            <div className="input-container">
                <div className="input-container-form-upload">
                    <label>
                        Upload Training Data:
                        <input
                            type="file"
                            accept=".csv, .json"
                            onChange={handleFileChange}
                        />
                    </label>
                    <label>
                        Number of Rows (optional):
                        <input
                            type="text"
                            placeholder="Default: Same as input"
                            value={rowCount}
                            onChange={handleRowCountChange}
                        />
                    </label>
                </div>
                <button onClick={handleGenerateSyntheticData} disabled={loading}>
                    {loading ? 'Generating...' : 'Generate Synthetic Data'}
                </button>
            </div>
            {loading && (
                <div className="loader">
                    <div className="host">
                        <div className="loading loading-0"></div>
                        <div className="loading loading-1"></div>
                        <div className="loading loading-2"></div>
                    </div>
                </div>
            )}
            {error && <p className="error">{error}</p>}
            {successMessage && <p className="success">{successMessage}</p>}
            {syntheticData && (
                <div className="data-output">
                    <button onClick={handleDownload} className="download-button">
                        Download Synthetic Data
                    </button>
                </div>
            )}
        </div>
    );
};

export default SyntheticDataGenerator;

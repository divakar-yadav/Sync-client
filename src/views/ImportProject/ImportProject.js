import React, { useState, useEffect } from 'react';
import './ImportProject.css';
const { ipcRenderer } = require('electron');

const ImportProject = () => {
  const [hashCode, setHashCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [projectInfo, setProjectInfo] = useState(null); // State for project information

  useEffect(() => {
    // Cleanup listener to avoid memory leaks
    return () => {
      ipcRenderer.removeAllListeners('project-data-response');
    };
  }, []);

  const handleInputChange = (e) => {
    setHashCode(e.target.value);
    setError('');
    setSuccessMessage('');
    setProjectInfo(null); // Clear previous project info when input changes
  };

  // Send a request to the main process to fetch the project data
  const fetchProjectData = (hashCode) => {
    ipcRenderer.send('fetch-project-data', hashCode);
  
    // Listen for the response from the main process
    ipcRenderer.on('project-data-response', (event, data) => {
      const projectData = JSON.parse(data);
      console.log('Project Data:', projectData);
      setProjectInfo(projectData.project); // Set the project info
      setSuccessMessage(`Project with hashcode ${hashCode} imported successfully!`);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate that hashCode is 64 characters long
    if (hashCode.length !== 64) {
      setError('The hashcode must be exactly 64 characters.');
      return;
    }

    // Fetch project information using the hashCode
    fetchProjectData(hashCode);
  };

  return (
    <div className="container">
      {/* If projectInfo is available, display project details and hide the form */}
      {projectInfo ? (
        <div className="project-info">
          <h3>Project Details:</h3>
          <p><strong>Project Name:</strong> {projectInfo.title}</p>
          <p><strong>Project Description:</strong> {projectInfo.short_description}</p>
          <p><strong>Started At:</strong> {new Date(projectInfo.start_date).toLocaleString()}</p>
          {/* Add more fields as needed */}
          <button type="submit" className="submit_button_training">Start Training</button>

        </div>
      ) : (
        <>
          <h2>Import Project</h2>
          <form onSubmit={handleSubmit} className="form">
            <label htmlFor="hashcode" className="label">Enter 64-Character Hashcode</label>
            <input
              type="text"
              id="hashcode"
              name="hashcode"
              value={hashCode}
              onChange={handleInputChange}
              maxLength={64} // Update character limit to 64
              placeholder="Enter hashcode"
              className="input"
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" className="submit_button">Import</button>
          </form>
          {successMessage && <p className="success">{successMessage}</p>}
        </>
      )}
    </div>
  );
};

export default ImportProject;

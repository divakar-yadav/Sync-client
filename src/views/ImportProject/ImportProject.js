import React, { useState } from 'react';
import './ImportProject.css';

const  ImportProject = ()=> {
  const [hashCode, setHashCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (e) => {
    setHashCode(e.target.value);
    setError('');
    setSuccessMessage('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate that hashCode is 16 digits long
    if (hashCode.length !== 16 || !/^\d{16}$/.test(hashCode)) {
      setError('The hashcode must be exactly 16 digits.');
      return;
    }
    
    // If valid, proceed with import
    setSuccessMessage(`Project with hashcode ${hashCode} imported successfully!`);
  };

  return (
    <div className="container">
      <h2>Import Project</h2>
      <form onSubmit={handleSubmit} className="form">
        <label htmlFor="hashcode" className="label">Enter 16-Digit Hashcode</label>
        <input 
          type="text" 
          id="hashcode" 
          name="hashcode" 
          value={hashCode} 
          onChange={handleInputChange} 
          maxLength={16} 
          placeholder="Enter hashcode" 
          className="input"
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button">Import</button>
      </form>
      {successMessage && <p className="success">{successMessage}</p>}
    </div>
  );
}

export default ImportProject;

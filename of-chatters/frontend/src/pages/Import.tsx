import { useState } from 'react';
import { api } from '../lib/api';

interface ImportStats {
  teams_created: number;
  chatters_created: number;
  performance_records: number;
  shift_records: number;
}

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        setFile(selectedFile);
        setError('');
        setStats(null);
      } else {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        setFile(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        setFile(droppedFile);
        setError('');
        setStats(null);
      } else {
        setError('Please drop a valid Excel file (.xlsx or .xls)');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError('');
    setStats(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await api<ImportStats>('/admin/import/excel', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type - browser will set it with boundary for multipart
        headers: {}, 
      });

      setStats(result);
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Import Data</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Excel File</h2>
        
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
        >
          {file ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
              <button
                onClick={() => setFile(null)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-800 font-medium">
                    Choose a file
                  </span>
                  <span className="text-gray-600"> or drag and drop</span>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-sm text-gray-500">Excel files only (.xlsx, .xls)</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {file && !error && (
          <div className="mt-6">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {uploading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </div>
              ) : (
                'Upload and Import'
              )}
            </button>
          </div>
        )}
      </div>

      {stats && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-semibold text-green-800">Import Successful!</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Teams Created</p>
              <p className="text-3xl font-bold text-blue-600">{stats.teams_created}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Chatters Created</p>
              <p className="text-3xl font-bold text-green-600">{stats.chatters_created}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Performance Records</p>
              <p className="text-3xl font-bold text-purple-600">{stats.performance_records}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Shift Records</p>
              <p className="text-3xl font-bold text-orange-600">{stats.shift_records}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Expected Excel Format</h3>
        <p className="text-sm text-gray-600 mb-2">
          The Excel file should contain a sheet named "Sheet3" with the following columns:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Team Name</li>
          <li>Chatter name</li>
          <li>Shift Hours</li>
          <li>Date (YYYY-MM-DD or MM/DD/YYYY format)</li>
          <li>Sales ($)</li>
          <li>Sold (count)</li>
          <li>Unlocks (count)</li>
          <li>PPV Revenue ($)</li>
          <li>Tips ($)</li>
          <li>Sexting ($)</li>
        </ul>
        <p className="text-sm text-gray-500 mt-3">
          Note: The system will automatically create teams and chatters if they don't exist.
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

export default function SMSConfig({ onClose }) {
  const [numbers, setNumbers] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadNumbers();
  }, []);

  const loadNumbers = async () => {
    try {
      const response = await fetch('/api/sms/numbers');
      const data = await response.json();
      if (data.length > 0) {
        setNumbers(data);
      }
    } catch (err) {
      console.error('Failed to load SMS numbers:', err);
    }
  };

  const handleAddNumber = () => {
    if (numbers.length < 10) {
      setNumbers([...numbers, '']);
    }
  };

  const handleRemoveNumber = (index) => {
    setNumbers(numbers.filter((_, i) => i !== index));
  };

  const handleNumberChange = (index, value) => {
    const newNumbers = [...numbers];
    newNumbers[index] = value;
    setNumbers(newNumbers);
  };

  const validatePhoneNumber = (number) => {
    // Remove all non-digits
    const cleaned = number.replace(/\D/g, '');
    // US phone numbers should be 10 digits
    return cleaned.length === 10;
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    // Filter out empty numbers and validate
    const validNumbers = numbers.filter(n => n.trim() !== '');

    for (const number of validNumbers) {
      if (!validatePhoneNumber(number)) {
        setError(`Invalid phone number: ${number}. Must be 10 digits.`);
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/sms/numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numbers: validNumbers }),
      });

      if (response.ok) {
        setSuccess('SMS alert numbers saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to save SMS numbers');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bluek9-dark border border-bluek9-cyan/30 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bluek9-cyan/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-bluek9-cyan">📱 SMS Alert Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              Configure up to 10 US phone numbers to receive SMS alerts when targets are detected.
              The system uses a SIMCOM7600 cellular radio to send alerts.
            </div>

            {/* Phone Numbers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-white">
                  Alert Phone Numbers ({numbers.filter(n => n.trim() !== '').length}/10)
                </label>
                {numbers.length < 10 && (
                  <button
                    onClick={handleAddNumber}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                  >
                    + Add Number
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {numbers.map((number, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm w-8">#{index + 1}</span>
                    <div className="flex-1 flex items-center">
                      <span className="px-3 py-2 bg-bluek9-darker border border-gray-600 border-r-0 rounded-l-lg text-gray-400">
                        +1
                      </span>
                      <input
                        type="tel"
                        value={number}
                        onChange={(e) => handleNumberChange(index, e.target.value)}
                        placeholder="5551234567"
                        maxLength={10}
                        className="flex-1 px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-r-lg focus:outline-none focus:border-bluek9-cyan"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveNumber(index)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-bluek9-cyan hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {/* Alert Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
            <div className="font-semibold text-blue-400 mb-2">📨 Alert Format</div>
            <div className="text-gray-300 text-xs space-y-1">
              <p>When a target is detected, you'll receive an SMS containing:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2 mt-2">
                <li>Target device name and MAC address</li>
                <li>System GPS location at time of detection</li>
                <li>First and last seen timestamps</li>
                <li>Signal strength (RSSI)</li>
              </ul>
              <p className="mt-3 text-yellow-400">
                ⚠ Note: Alerts are throttled to once per minute per target to avoid spam.
              </p>
            </div>
          </div>

          {/* Hardware Info */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-sm">
            <div className="font-semibold text-purple-400 mb-2">🔧 Hardware</div>
            <div className="text-gray-300 text-xs space-y-1">
              <p>This feature requires a SIMCOM7600 cellular radio module.</p>
              <p className="mt-2">
                If the modem is not detected, alerts will be logged to the system log only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

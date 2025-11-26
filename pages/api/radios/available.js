const { spawn } = require('child_process');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const bluetooth = await queryBluetoothRadios();
      const wifi = await queryWiFiRadios();

      res.status(200).json({ bluetooth, wifi });
    } catch (error) {
      console.error('Error querying radios:', error);
      res.status(500).json({ error: 'Failed to query radios' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

function queryBluetoothRadios() {
  return new Promise((resolve) => {
    const radios = [];
    const process = spawn('hciconfig', ['-a']);
    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', () => {
      // Parse hciconfig output
      const lines = output.split('\n');
      let currentDevice = null;
      let currentAddress = null;

      for (const line of lines) {
        // Match device name like "hci0:"
        const deviceMatch = line.match(/^(hci\d+):/);
        if (deviceMatch) {
          currentDevice = deviceMatch[1];
          continue;
        }

        // Match BD Address
        const addressMatch = line.match(/BD Address:\s+([0-9A-Fa-f:]+)/);
        if (addressMatch && currentDevice) {
          currentAddress = addressMatch[1];
          radios.push({
            device: currentDevice,
            address: currentAddress
          });
          currentDevice = null;
          currentAddress = null;
        }
      }

      resolve(radios);
    });

    process.on('error', () => {
      resolve([]); // Return empty array if command fails
    });
  });
}

function queryWiFiRadios() {
  return new Promise((resolve) => {
    const radios = [];
    const process = spawn('iwconfig');
    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', () => {
      // Parse iwconfig output
      const lines = output.split('\n');

      for (const line of lines) {
        // Match wireless interface like "wlan0" or "wlp3s0"
        const match = line.match(/^(wlan\d+|wlp\d+s\d+|wlo\d+)\s+IEEE/);
        if (match) {
          const device = match[1];
          // Try to get more info with iw dev
          radios.push({
            device: device,
            driver: 'Unknown',
            chipset: 'Unknown'
          });
        }
      }

      // If no radios found with iwconfig, try 'ip link'
      if (radios.length === 0) {
        const ipProcess = spawn('ip', ['link', 'show']);
        let ipOutput = '';

        ipProcess.stdout.on('data', (data) => {
          ipOutput += data.toString();
        });

        ipProcess.on('close', () => {
          const ipLines = ipOutput.split('\n');
          for (const line of ipLines) {
            const match = line.match(/^\d+:\s+(wlan\d+|wlp\d+s\d+|wlo\d+):/);
            if (match) {
              radios.push({
                device: match[1],
                driver: 'Unknown',
                chipset: 'Unknown'
              });
            }
          }
          resolve(radios);
        });

        ipProcess.on('error', () => {
          resolve([]);
        });
      } else {
        resolve(radios);
      }
    });

    process.on('error', () => {
      resolve([]); // Return empty array if command fails
    });
  });
}

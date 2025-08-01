const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Debug endpoint to see exactly what data is being sent
app.post('/debug-class-data', (req, res) => {
  console.log('🔍 DEBUG: Received class data:');
  console.log('Raw body:', req.body);
  console.log('');
  
  Object.keys(req.body).forEach(key => {
    const value = req.body[key];
    console.log(`${key}:`);
    console.log(`  Value: ${value}`);
    console.log(`  Type: ${typeof value}`);
    console.log(`  Is UUID: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)}`);
    console.log(`  Is Integer: ${/^\d+$/.test(String(value))}`);
    console.log('');
  });
  
  res.json({
    success: true,
    message: 'Data received and logged',
    data: req.body
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🔍 Debug server running on http://localhost:${PORT}`);
  console.log('Send POST requests to /debug-class-data to see the data structure');
});

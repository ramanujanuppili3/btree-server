const express = require('express');
const neo4j = require('neo4j-driver');

const app = express();
const PORT = process.env.PORT || 3000;

// Neo4j connection details
const driver = neo4j.driver(
  'bolt://localhost:7687', // Neo4j connection URL
  neo4j.auth.basic('neo4j', 'your_password') // username and password
);

const session = driver.session();

// Basic GET API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

// GET endpoint to fetch data from Neo4j
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const result = await session.run(
      'MATCH (u:User {id: $id}) RETURN u.name as name, u.email as email',
      { id: userId }
    );
    
    if (result.records.length > 0) {
      const record = result.records[0];
      res.json({ 
        userId: userId, 
        name: record.get('name'),
        email: record.get('email')
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Close driver on exit
process.on('exit', () => driver.close());
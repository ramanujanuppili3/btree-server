const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
const PORT = process.env.PORT || 3000;

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'anujIN123'
  )
);

// Middleware
app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// Create sample tree
app.post('/api/btree/create-sample', async (req, res) => {
  const session = driver.session();
  
  try {
    // ... your existing code
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Fetch B-tree node
app.get('/api/btree/node/:nodeId', async (req, res) => {
  const session = driver.session();
  
  try {
    const { nodeId } = req.params;
    
    const result = await session.run(
      `MATCH (node:TreeNode {id: $nodeId})
       OPTIONAL MATCH (node)-[r]->(child:TreeNode)
       RETURN node, collect({relation: type(r), child: child}) as children`,
      { nodeId }
    );
    
    if (result.records.length > 0) {
      const record = result.records[0];
      res.json({
        node: record.get('node').properties,
        children: record.get('children').filter(c => c.child !== null)
      });
    } else {
      res.status(404).json({ message: 'Node not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Get entire tree
app.get('/api/btree/tree', async (req, res) => {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH (root:TreeNode {id: 'root'})
       OPTIONAL MATCH (root)-[r]->(child:TreeNode)
       RETURN root, collect(DISTINCT child) as children`
    );
    
    if (result.records.length > 0) {
      const record = result.records[0];
      res.json({
        root: record.get('root').properties,
        children: record.get('children').filter(c => c !== null).map(c => c.properties)
      });
    } else {
      res.status(404).json({ message: 'Tree not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

app.listen(PORT, () => {
  console.log(`✓ btree-server running on http://localhost:${PORT}`);
  console.log(`✓ CORS enabled for http://localhost:3001`);
});

process.on('exit', () => driver.close());
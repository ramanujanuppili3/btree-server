const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
const PORT = process.env.PORT || 3005;

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
  origin: 'http://localhost:3000',
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

// ✅ PUT: Update tree node value
app.put('/api/btree/node/:nodeId/update', async (req, res) => {
  const session = driver.session();

  try {
    const { nodeId } = req.params;
    const { value, index } = req.body;

    console.log(`🔧 Updating node: ${nodeId}`);
    console.log(`   New value: ${value}`);
    console.log(`   Index: ${index}`);

    // Validate input
    if (!value && index === undefined) {
      return res.status(400).json({ error: 'Must provide value or index to update' });
    }

    // Build update query
    let updateQuery = `MATCH (node:TreeNode {id: $nodeId}) SET `;
    const params = { nodeId };

    if (value !== undefined) {
      updateQuery += `node.value = $value`;
      params.value = value;
    }

    if (index !== undefined) {
      if (value !== undefined) updateQuery += ', ';
      updateQuery += `node.index = $index`;
      params.index = index;
    }

    updateQuery += ` RETURN node`;

    const result = await session.run(updateQuery, params);

    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const updatedNode = result.records[0].get('node');

    console.log(`✅ Node updated successfully`);

    res.json({
      success: true,
      node: {
        id: updatedNode.properties.id,
        index: updatedNode.properties.index,
        value: updatedNode.properties.value
      }
    });

  } catch (err) {
    console.error("❌ Error updating node:", err);
    res.status(500).json({ error: err.message });
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
      `MATCH (root:TreeNode {id: 'rootTree'})
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


app.get('/api/btree/nested', async (req, res) => {
  const session = driver.session();
  
  try {
    const result = await session.run(`
      MATCH (root:TreeNode {id: 'node_48'})
      OPTIONAL MATCH (root)-[:LEFT]->(left:TreeNode)
      OPTIONAL MATCH (root)-[:RIGHT]->(right:TreeNode)
      OPTIONAL MATCH (left)-[:LEFT]->(leftLeft:TreeNode)
      OPTIONAL MATCH (left)-[:RIGHT]->(leftRight:TreeNode)
      OPTIONAL MATCH (right)-[:LEFT]->(rightLeft:TreeNode)
      OPTIONAL MATCH (right)-[:RIGHT]->(rightRight:TreeNode)
      RETURN {
        value: root.value,
        nodeId: root.id,
        index: root.index,
        left: CASE WHEN left IS NOT NULL THEN {
          value: left.value,
          nodeId: left.id,
          index: left.index,
          left: CASE WHEN leftLeft IS NOT NULL THEN {value: leftLeft.value, index: leftLeft.index} END,
          right: CASE WHEN leftRight IS NOT NULL THEN {value: leftRight.value, index: leftRight.index} END
        } END,
        right: CASE WHEN right IS NOT NULL THEN {
          value: right.value,
          nodeId: right.id,
          index: right.index,
          left: CASE WHEN rightLeft IS NOT NULL THEN {value: rightLeft.value, index: rightLeft.index} END,
          right: CASE WHEN rightRight IS NOT NULL THEN {value: rightRight.value, index: rightRight.index} END
        } END
      } as tree
    `);

    if (result.records.length > 0) {
      res.json(result.records[0].get('tree'));
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
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

// ✅ POST: Insert an intermediary node between an existing parent and child
app.post('/api/btree/node/create', async (req, res) => {
  const session = driver.session();

  try {
    const {
      parentId,
      childId,
      intermediaryId,
      value,
      index
    } = req.body;

    if (!parentId || !childId) {
      return res.status(400).json({
        error: 'parentId and childId are required'
      });
    }

    const middleId = intermediaryId || `node_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const middleValue = value !== undefined ? value : null;
    const middleIndex = index !== undefined ? index : null;

    // Find the existing relationship type between parent and child
    const relResult = await session.run(
      `
        MATCH (parent:TreeNode {id: $parentId})-[rel]->(child:TreeNode {id: $childId})
        RETURN type(rel) AS relType
      `,
      { parentId, childId }
    );

    if (relResult.records.length === 0) {
      return res.status(404).json({
        error: 'No parent-child relationship found'
      });
    }

    const relType = relResult.records[0].get('relType');

    // Only allow tree-style relationship types
    if (!['LEFT', 'RIGHT', 'PARENT_OF'].includes(relType)) {
      return res.status(400).json({
        error: `Unsupported relationship type: ${relType}`
      });
    }

    const query = `
      MATCH (parent:TreeNode {id: $parentId})-[oldRel]->(child:TreeNode {id: $childId})
      CREATE (middle:TreeNode {
        id: $middleId,
        value: $middleValue,
        index: $middleIndex
      })
      DELETE oldRel
      CREATE (parent)-[:${relType}]->(middle)
      CREATE (middle)-[:${relType}]->(child)
      RETURN middle
    `;


    console.log(`🔗 Inserting intermediary node between parent '${parentId}' and child '${childId}'   middleId: ${middleId},
      middleValue: ${middleValue},
      middleIndex: ${middleIndex}`);

    const result = await session.run(query, {
      parentId,
      childId,
      middleId,
      middleValue,
      middleIndex
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        error: 'Unable to insert intermediate node'
      });
    }

    const newNode = result.records[0].get('middle');

    return res.status(201).json({
      success: true,
      insertedNode: {
        id: newNode.properties.id,
        value: newNode.properties.value,
        index: newNode.properties.index
      },
      parentId,
      childId,
      relationshipType: relType
    });

  } catch (err) {
    console.error('❌ Error inserting intermediary node:', err);
    return res.status(500).json({ error: err.message });
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
    const rootId = req.query.rootId || 'node_48';

    const result = await session.run(
      `
      MATCH (root:TreeNode {id: $rootId})
      OPTIONAL MATCH (root)-[:LEFT|RIGHT*0..]->(node:TreeNode)
      WITH collect(DISTINCT node) AS nodes

      UNWIND nodes AS parent
      OPTIONAL MATCH (parent)-[relationship:LEFT|RIGHT]->(child:TreeNode)

      RETURN nodes,
             collect({
               parentId: parent.id,
               relationshipType: type(relationship),
               child: child
             }) AS edges
      `,
      { rootId }
    );

    if (result.records.length === 0) {
      return res.status(404).json({
        error: `Root node '${rootId}' not found`
      });
    }

    const record = result.records[0];
    const nodes = record.get('nodes');
    const edges = record.get('edges');

    const nodeMap = new Map();

    nodes
      .filter(node => node !== null)
      .forEach(node => {
        nodeMap.set(node.properties.id, {
          value: node.properties.value,
          nodeId: node.properties.id,
          index: node.properties.index,
          left: null,
          right: null
        });
      });

    edges
      .filter(edge => edge.child !== null)
      .forEach(edge => {
        const parent = nodeMap.get(edge.parentId);
        const child = nodeMap.get(edge.child.properties.id);

        if (!parent || !child) {
          return;
        }

        if (edge.relationshipType === 'LEFT') {
          parent.left = child;
        }

        if (edge.relationshipType === 'RIGHT') {
          parent.right = child;
        }

        // Supports trees that use PARENT_OF relationships.
        if (edge.relationshipType === 'PARENT_OF') {
          if (!parent.left) {
            parent.left = child;
          } else if (!parent.right) {
            parent.right = child;
          }
        }
      });

    const tree = nodeMap.get(rootId);

    if (!tree) {
      return res.status(404).json({
        error: `Root node '${rootId}' not found`
      });
    }

    return res.json(tree);
  } catch (error) {
    console.error('Error fetching nested tree:', error);

    return res.status(500).json({
      error: error.message
    });
  } finally {
    await session.close();
  }
});


app.listen(PORT, () => {
  console.log(`✓ btree-server running on http://localhost:${PORT}`);
  console.log(`✓ CORS enabled for http://localhost:3001`);
});

process.on('exit', () => driver.close());
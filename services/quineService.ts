import { GraphData, GraphNode, GraphLink } from '../types';

export const executeQuineQuery = async (baseUrl: string, cypher: string, params: Record<string, any> = {}): Promise<any> => {
  // Ensure protocol and remove trailing slash
  let url = baseUrl.trim().replace(/\/$/, '');
  if (!url.startsWith('http')) {
    url = `http://${url}`;
  }
  url = `${url}/api/v1/query/cypher`;

  console.log(`Executing Quine Query at ${url} with params:`, params);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Ensure params is an object, even if empty
      body: JSON.stringify({ text: cypher, parameters: params || {} }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Quine API Error ${response.status}: ${errorText || response.statusText}`);
    }
    
    const json = await response.json();
    return json;
  } catch (error) {
    console.error("Quine Query Failed:", error);
    
    let errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide more specific hints for common browser fetch errors
    if (errorMessage.includes("Failed to fetch")) {
       errorMessage = `Connection failed to ${url}.`;
       
       const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
       const isTargetHttp = url.startsWith('http:');

       if (isHttps && isTargetHttp) {
         errorMessage += " (Blocked: Mixed Content. Cannot access HTTP Quine from HTTPS App. Use ngrok or serve App via HTTP)";
       } else {
         errorMessage += " (Check: Is Quine running? Is CORS enabled? Is the port correct?)";
       }
    }
    
    throw new Error(errorMessage);
  }
};

export const parseQuineResult = (result: any): GraphData => {
  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  if (!result || !result.results) return { nodes: [], links: [] };

  const processItem = (item: any) => {
    if (!item || typeof item !== 'object') return;

    // Detect Node: has 'id' and 'labels' (standard Quine/Cypher JSON)
    if ('id' in item && 'labels' in item) {
      const nodeId = String(item.id);
      if (!nodesMap.has(nodeId)) {
        nodesMap.set(nodeId, {
          id: nodeId,
          // Assign random 3D position for visualization if not present
          x: (Math.random() - 0.5) * 40,
          y: (Math.random() - 0.5) * 40,
          z: (Math.random() - 0.5) * 40,
          val: 1, // Default size
          group: item.labels.length > 0 ? item.labels[0] : 'Default',
          color: undefined
        });
      }
    }

    // Detect Relationship: has 'start', 'end'
    if ('start' in item && 'end' in item) {
      links.push({
        source: String(item.start),
        target: String(item.end)
      });
      
      // Create placeholder nodes if they don't exist yet to ensure link validity
      [item.start, item.end].forEach((id: any) => {
        const nodeId = String(id);
        if (!nodesMap.has(nodeId)) {
          nodesMap.set(nodeId, {
            id: nodeId,
            x: (Math.random() - 0.5) * 40,
            y: (Math.random() - 0.5) * 40,
            z: (Math.random() - 0.5) * 40,
            val: 0.5,
            group: 'Unknown'
          });
        }
      });
    }
  };

  // Iterate through all rows and columns
  result.results.forEach((row: any[]) => {
    row.forEach((col: any) => {
      if (Array.isArray(col)) {
        col.forEach(processItem); // Handle paths or lists
      } else {
        processItem(col);
      }
    });
  });

  return {
    nodes: Array.from(nodesMap.values()),
    links
  };
};
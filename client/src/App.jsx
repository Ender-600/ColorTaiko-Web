import { useState, useRef, useEffect } from "react";
import InputBox from "./InputBox";
import TaikoNode from "./TaikoNode";
import ErrorModal from "./ErrorModal";
import LargeArcEdge from "./LargeArcEdge";

import { generateColor } from './utils/colorUtils';


import clickSound from "./assets/sound effect/Click.wav";
import errorSound from "./assets/sound effect/Error.wav";
import connectSound from "./assets/sound effect/Connection.wav";

const edgeTypes = {
  custom: LargeArcEdge, // Register custom arc edge type
};

function App() {
  const [topRowCount, setTopRowCount] = useState(1);
  const [bottomRowCount, setBottomRowCount] = useState(1);
  const [showNodes, setShowNodes] = useState(true);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [edgeState, setEdgeState] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const svgRef = useRef(null);

  const [progress, setProgress] = useState(0);

  const clickAudio = new Audio(clickSound);
  const errorAudio = new Audio(errorSound);
  const connectAudio = new Audio(connectSound);

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const [currentColor, setCurrentColor] = useState(0);


  // store the pair of edges
  const [connectionPairs, setConnectionPairs] = useState([]);

  const [connectionGroups, setConnectionGroups] = useState([]);
  const groupMapRef = useRef(new Map());


  useEffect(() => {
    // console.log("Connections updated:", connections);
    drawConnections();
  }, [connections, topRowCount, bottomRowCount, connectionPairs, connectionGroups, groupMapRef]);

  useEffect(() => {
    checkAndAddNewNodes();
  }, [connections, topRowCount, bottomRowCount]);

  useEffect(() => {
    //console.log("CONNECTION PAIRS:", connectionPairs);
  }, [connectionPairs]);

  useEffect(() => {
    calculateProgress();
  }, [connections, topRowCount, bottomRowCount]);

  useEffect(() => {
    const handleResize = () => {
      drawConnections(); 
    };
  
    window.addEventListener('resize', handleResize);
  
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [connections, connectionPairs]);

  useEffect(() => {
    const latestPair = connectionPairs[connectionPairs.length - 1];
    if (latestPair && latestPair.length === 2) {
      checkAndGroupConnections(latestPair);
    }
  }, [connectionPairs, connections]);

  const checkAndAddNewNodes = () => {
    const allTopNodesConnected = Array.from({ length: topRowCount }, (_, i) =>
      connections.some((conn) => conn.nodes.includes(`top-${i}`))
    ).every(Boolean);

    const allBottomNodesConnected = Array.from(
      { length: bottomRowCount },
      (_, i) => connections.some((conn) => conn.nodes.includes(`bottom-${i}`))
    ).every(Boolean);

    if (allTopNodesConnected || allBottomNodesConnected) {
      if (allTopNodesConnected) {
        setTopRowCount((prev) => prev + 1);
      } else {
        setBottomRowCount((prev) => prev + 1);
      }
    }
  };

  const createTopRow = (count) => {
    return Array.from({ length: count }, (_, i) => (
      <>
        <TaikoNode
          key={`top-${i}`}
          id={`top-${i}`}
          onClick={() => handleNodeClick(`top-${i}`)}
          isSelected={selectedNodes.includes(`top-${i}`)}
          index={i}
          totalCount={topRowCount}
        />
      </>
    ));
  };

  const createBottomRow = (count) => {
    return Array.from({ length: count }, (_, i) => (
      <TaikoNode
        key={`bottom-${i}`}
        id={`bottom-${i}`}
        onClick={() => handleNodeClick(`bottom-${i}`)}
        isSelected={selectedNodes.includes(`bottom-${i}`)}
        index={i}
        totalCount={bottomRowCount}
      />
    ));
  };

  const handleNodeClick = (nodeId) => {
    setErrorMessage("");
    connectAudio.play();
    if (selectedNodes.includes(nodeId)) {
      setSelectedNodes(selectedNodes.filter((id) => id !== nodeId));
    } else {
      if (selectedNodes.length < 2) {
        const newSelectedNodes = [...selectedNodes, nodeId];
        setSelectedNodes(newSelectedNodes);
        if (newSelectedNodes.length === 2) {
          tryConnect(newSelectedNodes);
        }
      }
    }
  };

  

  const tryConnect = (nodes) => {
    if (nodes.length !== 2) return;
    const [node1, node2] = nodes;
    const isTopNode = (id) => id.startsWith("top");
    const isBottomNode = (id) => id.startsWith("bottom");

    if (
      (isTopNode(node1) && isTopNode(node2)) ||
      (isBottomNode(node1) && isBottomNode(node2))
    ) {
      errorAudio.play();
      setErrorMessage("Can't connect two nodes from the same row.");
      setSelectedNodes([]);
      return;
    }

    const isDuplicate = connections.some(
      (conn) =>
        (conn.nodes.includes(node1) && conn.nodes.includes(node2)) ||
        (conn.nodes.includes(node2) && conn.nodes.includes(node1))
    );
  
    if (isDuplicate) {
      errorAudio.play();
      setErrorMessage("These nodes are already connected.");
      setSelectedNodes([]);
      return;
    }

    if (
      edgeState && (edgeState.nodes.includes(node1) || edgeState.nodes.includes(node2))
    ) {
      errorAudio.play();
      setErrorMessage(
        "Two vertical edges in each pair should not share a common vertex"
      );
      setSelectedNodes([]);
      return;
    }

    let newColor;
    if (edgeState) {
      // If there is a pending edge, use the same color and create a pair
      newColor = edgeState.color;
      const newConnection = {
        nodes: nodes,
        color: newColor,
      };
      setConnections([...connections, newConnection]);
      setConnectionPairs((prevPairs) => {
        const lastPair = prevPairs[prevPairs.length - 1];
        let updatedPairs;
        if (lastPair && lastPair.length === 1) {
          // If the last pair has one connection, complete it
          updatedPairs = [...prevPairs.slice(0, -1), [...lastPair, newConnection]];
        } else {
          // Otherwise, create a new pair
          updatedPairs = [...prevPairs, [edgeState, newConnection]];
        }
        return updatedPairs;
  
      });
      console.log(connectionPairs);
      setEdgeState(null);
    } else {
      // If no pending edge, create a new edge and add to edgeState
      newColor = generateColor(currentColor, setCurrentColor);
      console.log("newColor: ", newColor);
      //console.log(newColor);
      const newConnection = {
        nodes: nodes,
        color: newColor,
      };
      setConnections([...connections, newConnection]);
      // Create a new pair and add to the connection pairs
      setConnectionPairs([...connectionPairs, [newConnection]]);
      setEdgeState(newConnection);
    }
    setSelectedNodes([]);
  };

  const drawArc = (startRect, endRect, svgRect, color, arcHeight) => {
    const midX = (startRect.left + endRect.left) / 2;
    const startY = startRect.top + startRect.height / 2 - svgRect.top;
    const endY = endRect.top + endRect.height / 2 - svgRect.top;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Modify arcHeight: negative for upward arc, positive for downward arc
    const d = `
      M ${startRect.left + startRect.width / 2 - svgRect.left}, ${startY} 
      C ${midX}, ${startY + arcHeight} ${midX}, ${endY + arcHeight} 
      ${endRect.left + endRect.width / 2 - svgRect.left}, ${endY}
    `;

    line.setAttribute("d", d.trim());
    line.setAttribute("stroke", color);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke-width", "4");


    svgRef.current.appendChild(line);
  };

  const drawConnections = () => {
    if (!svgRef.current) return;
  
    // Clear existing lines and curves
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }
  
    // Get the latest SVG container position and size
    const svgRect = svgRef.current.getBoundingClientRect();
  
    // Draw straight line connections
    connections.forEach(({ nodes: [start, end], color }) => {
      const startElement = document.getElementById(start);
      const endElement = document.getElementById(end);
  
      if (startElement && endElement) {
        // Get the latest node positions
        const startRect = startElement.getBoundingClientRect();
        const endRect = endElement.getBoundingClientRect();
  
        // Calculate the start and end points of the line
        const startX = startRect.left + startRect.width / 2 - svgRect.left;
        const startY = startRect.top + startRect.height / 2 - svgRect.top;
        const endX = endRect.left + endRect.width / 2 - svgRect.left;
        const endY = endRect.top + endRect.height / 2 - svgRect.top;
  
        // Create a straight line
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", startX);
        line.setAttribute("y1", startY);
        line.setAttribute("x2", endX);
        line.setAttribute("y2", endY);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "4");
        line.setAttribute("stroke-linecap", "round");
  
        svgRef.current.appendChild(line);
      }
    });
  
    // Draw curved connections
    connectionPairs.forEach((pair) => {
      if (pair.length === 2) {
        const [
          {
            nodes: [startNode1, bottomNode1],
          },
          {
            nodes: [startNode2, bottomNode2],
            color,
          },
        ] = pair;
  
        // Determine if the node is top or bottom
        const topFirst1 = !startNode1.startsWith("bottom");
        const topFirst2 = !startNode2.startsWith("bottom");
  
        // Function to create a curved path
        const createCurvedPath = (startNode, endNode, isTopCurve) => {
          const startElement = document.getElementById(startNode);
          const endElement = document.getElementById(endNode);
          if (!startElement || !endElement) return null; // Ensure nodes exist
  
          const startRect = startElement.getBoundingClientRect();
          const endRect = endElement.getBoundingClientRect();
  
          const startX = startRect.left + startRect.width / 2 - svgRect.left;
          const startY = startRect.top + startRect.height / 2 - svgRect.top;
          const endX = endRect.left + endRect.width / 2 - svgRect.left;
          const endY = endRect.top + endRect.height / 2 - svgRect.top;
  
          const dx = endX - startX;
          const dy = endY - startY;
          const distance = Math.sqrt(dx * dx + dy * dy);
  
          const controlX = (startX + endX) / 2;
          const controlY = isTopCurve 
            ? Math.min(startY, endY) - (distance / 5)
            : Math.max(startY, endY) + (distance / 5);
  
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          const d = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`;
          path.setAttribute("d", d);
          path.setAttribute("stroke", color);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke-width", "4");
          path.setAttribute("stroke-linecap", "round");
  
          return path;
        };
  
        // Draw the top and bottom curves
        const topCurve = createCurvedPath(
          topFirst1 ? startNode1 : bottomNode1,
          topFirst2 ? startNode2 : bottomNode2,
          true // Top curve
        );
        if (topCurve) svgRef.current.appendChild(topCurve);
  
        const bottomCurve = createCurvedPath(
          topFirst1 ? bottomNode1 : startNode1,
          topFirst2 ? bottomNode2 : startNode2,
          false // Bottom curve
        );
        if (bottomCurve) svgRef.current.appendChild(bottomCurve);
      }
    });
  };
  

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowNodes(true);
    setConnections([]);
    setSelectedNodes([]);
    setErrorMessage("");
  };

  const handleClear = () => {
    setConnectionPairs([])
    setConnections([]);
    setSelectedNodes([]);
    setBottomRowCount(1);
    setTopRowCount(1);
    setEdgeState(null);
    setErrorMessage("");
    setProgress(0);
    setConnectionGroups([]);
    setCurrentColor(0);
    groupMap.clear();
    console.log(connectionPairs);
  };
  
  const calculateProgress = () => {
    let totalPossibleConnections = (topRowCount - 1) *  (bottomRowCount - 1);
    if (totalPossibleConnections % 2 !== 0) {
      totalPossibleConnections -= 1;
    }
    const verticalEdges = connections.length;
    const progressPercentage = totalPossibleConnections > 4 ? (verticalEdges / totalPossibleConnections) * 100 : 0;
    setProgress(progressPercentage);
  };

  const showTooltip = (e) => {
    setTooltipVisible(true);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const hideTooltip = () => {
    setTooltipVisible(false);
  };


  useEffect(() => {
    console.log("Updated Connection Groups:", connectionGroups);
  }, [connectionGroups]);

  const checkAndGroupConnections = (newPair) => {

    const [firstConnection, secondConnection] = newPair;
    const [top1, bottom1] = firstConnection.nodes;
    const [top2, bottom2] = secondConnection.nodes;

    const topCombination = [top1, top2].sort().join(",");
    const bottomCombination = [bottom1, bottom2].sort().join(",");

    // Find all matching targetGroups
    let matchingGroups = [];
    console.log("Matching Groups:", matchingGroups);
    groupMapRef.current.forEach((group, key) => {
        if (key === topCombination || key === bottomCombination) {
            matchingGroups.push(group);
        }
    });

    let mergedGroup = null;
    if (matchingGroups.length > 0) {
      // If multiple matching groups are found, merge them
      mergedGroup = matchingGroups[0];

      // Merge newPair into mergedGroup
      newPair.forEach((connection) => {
          if (connection.color !== mergedGroup.color) {
              connection.color = mergedGroup.color;
          }
          if (!mergedGroup.pairs.includes(connection)) {
              mergedGroup.pairs.push(connection);
          }
      });

      mergedGroup.nodes = Array.from(
          new Set([...mergedGroup.nodes, top1, top2, bottom1, bottom2])
      );

      // Merge all other matching groups into mergedGroup
      for (let i = 1; i < matchingGroups.length; i++) {
          const groupToMerge = matchingGroups[i];
          mergedGroup.nodes = Array.from(
              new Set([...mergedGroup.nodes, ...groupToMerge.nodes])
          );
          mergedGroup.pairs = Array.from(
              new Set([...mergedGroup.pairs, ...groupToMerge.pairs])
          );
      }

      // Remove old group keys
      groupMapRef.current.forEach((group, key) => {
          if (matchingGroups.includes(group) && group !== mergedGroup) {
              groupMapRef.current.delete(key);
          }
      });

      // Update combination keys to the merged group
      groupMapRef.current.set(topCombination, mergedGroup);
      groupMapRef.current.set(bottomCombination, mergedGroup);

      console.log("Merged Group:", mergedGroup);
      console.log("GroupMap", groupMapRef.current);

  } else {
      // If no matching groups are found, create a new group
      const groupColor = firstConnection.color;
      newPair.forEach((connection) => (connection.color = groupColor));
      const newGroup = {
          nodes: [top1, top2, bottom1, bottom2],
          pairs: [...newPair],
          color: groupColor,
      };

      // Add to groupMap
      groupMapRef.current.set(topCombination, newGroup);
      groupMapRef.current.set(bottomCombination, newGroup);

      // Update connection groups state
      setConnectionGroups((prevGroups) => [...prevGroups, newGroup]);

        //console.log("New Group Added:", newGroup);
        //console.log("Connection Pairs:", connectionPairs);
    }

};



  return (
    
    <div
      style={{
        textAlign: "center",
        position: "relative",
        fontFamily: "Arial, sans-serif",
      }}
      className="AppContainer"
    >
    <h1 className="title">
      <a href="https://mineyev.web.illinois.edu/ColorTaiko!/" target="_blank" style={{ textDecoration: "none" }}>
        <span style={{ color: '#e6194b', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>C</span>
        <span style={{ color: '#3cb44b', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>o</span>
        <span style={{ color: '#ffe119', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>l</span>
        <span style={{ color: '#f58231', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>o</span>
        <span style={{ color: '#dcbeff', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>r</span>
        <span style={{ color: '#9a6324', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>T</span>
        <span style={{ color: '#fabebe', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>a</span>
        <span style={{ color: '#7f00ff', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>i</span>
        <span style={{ color: '#f032e6', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>k</span>
        <span style={{ color: '#42d4f4', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>o</span>
        <span style={{ color: '#bfef45', backgroundColor: '#000000', fontSize: 'inherit', display: 'inline-block' }}>!</span>
      </a>
    </h1>

      <div
        className="progress-bar-container"
        onMouseEnter={showTooltip}
        onMouseMove={showTooltip}
        onMouseLeave={hideTooltip}
      >
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
          <span className="progress-bar-text">{Math.round(progress)}%</span>
        </div>
      </div>

      {tooltipVisible && (
        <div
          className="tooltip"
          style={{ top: tooltipPosition.y + 10, left: tooltipPosition.x + 10 }}
        >
          <p>Vertical Edges: {connections.length}</p>
          <p>Top Nodes: {topRowCount - 1}</p>
          <p>Bottom Nodes: {bottomRowCount - 1}</p>
        </div>
      )}

      <button
        onClick={handleClear}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          padding: "10px 20px",
          fontSize: "16px",
          backgroundColor: "#f44336",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          fontFamily: "inherit", // This will use the font from the parent element
        }}
      >
        Clear
      </button>

      <ErrorModal className = "error-container" message={errorMessage} onClose={() => setErrorMessage("")} />

      {showNodes && (
        <div className="GameBox" style={{ position: "relative" }}>
          <div className="GameRow">{createTopRow(topRowCount)}</div>
          <svg
            ref={svgRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
          <div className="GameRow" style={{ marginTop: "100px" }}>
            {createBottomRow(bottomRowCount)}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

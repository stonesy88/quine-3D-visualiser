import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { GraphData, ControlState } from '../types';

interface ParticlesProps {
  data: GraphData;
  controlState: ControlState;
  color: string;
}

const Particles: React.FC<ParticlesProps> = ({ data, controlState, color }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Store original positions to interpolate from
  const originalPositions = useMemo(() => {
    return data.nodes.map(n => new THREE.Vector3(n.x, n.y, n.z));
  }, [data]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const { expansion, tension } = controlState;
    const time = state.clock.getElapsedTime();

    // Pulse effect based on tension
    const pulse = 1 + Math.sin(time * 5) * (tension * 0.3);

    data.nodes.forEach((node, i) => {
      const original = originalPositions[i] || new THREE.Vector3(0,0,0);
      
      // Expansion logic: Move away from center based on expansion factor
      const expandVec = original.clone().normalize().multiplyScalar(expansion * 20);
      const pos = original.clone().add(expandVec);
      
      // Jitter based on tension (simulating unstable nodes)
      if (tension > 0.1) {
        pos.x += (Math.random() - 0.5) * tension;
        pos.y += (Math.random() - 0.5) * tension;
        pos.z += (Math.random() - 0.5) * tension;
      }

      dummy.position.copy(pos);
      
      // Scale based on tension/pulse
      const scale = (node.val || 1) * (1 + expansion) * (tension > 0.5 ? pulse : 1);
      dummy.scale.set(scale, scale, scale);
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Dynamic light color
    if (lightRef.current) {
        lightRef.current.intensity = 1 + tension * 2;
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, data.nodes.length]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.5 + controlState.tension}
          roughness={0.2}
          metalness={0.8}
        />
      </instancedMesh>
      <pointLight ref={lightRef} position={[0, 0, 0]} distance={50} decay={2} color={color} />
    </>
  );
};

// Simple visualizer for links
const Links: React.FC<{ data: GraphData; controlState: ControlState; color: string }> = ({ data, controlState, color }) => {
  const { expansion } = controlState;
  
  // Create line segments
  // We need to map node IDs to positions efficiently
  const nodeMap = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    data.nodes.forEach(n => map.set(n.id, new THREE.Vector3(n.x, n.y, n.z)));
    return map;
  }, [data]);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    data.links.forEach(link => {
      const sourcePos = nodeMap.get(link.source);
      const targetPos = nodeMap.get(link.target);
      if (sourcePos && targetPos) {
        pts.push(sourcePos);
        pts.push(targetPos);
      }
    });
    return pts;
  }, [data, nodeMap]);

  // If we want lines to expand with nodes, we would need to animate them frame-by-frame or use a shader.
  // For performance in this demo with simple lines, we'll just render static lines relative to the "base" state
  // or simple lines. Implementing fully expanded dynamic lines requires a more complex Line implementation.
  // We will skip dynamic expansion for lines for performance and clarity, or just render them fading out.
  
  if (points.length === 0) return null;

  return (
    <Line
      points={points}
      color={color}
      opacity={0.1}
      transparent
      lineWidth={1}
    />
  );
};

interface GraphSceneProps {
  controlState: ControlState;
  particleColor: string;
  graphData: GraphData;
}

export const GraphScene: React.FC<GraphSceneProps> = ({ controlState, particleColor, graphData }) => {
  return (
    <Canvas camera={{ position: [0, 0, 40], fov: 60 }}>
      <color attach="background" args={['#0f172a']} />
      <ambientLight intensity={0.5} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <Particles data={graphData} controlState={controlState} color={particleColor} />
      <Links data={graphData} controlState={controlState} color={particleColor} />
      
      <OrbitControls enablePan={false} enableZoom={true} autoRotate={controlState.tension < 0.1} autoRotateSpeed={0.5} />
      
      {/* Visual Feedback for Gesture */}
      {controlState.tension > 0.5 && (
         <Text position={[0, 15, 0]} fontSize={2} color="#f43f5e" anchorX="center" anchorY="middle">
           HIGH TENSION DETECTED
         </Text>
      )}
    </Canvas>
  );
};
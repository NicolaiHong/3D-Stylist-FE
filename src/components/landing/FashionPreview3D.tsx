import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Box3, Group, Mesh, PerspectiveCamera, Vector3 } from "three";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_PATH = "/models/fashion-avatar.glb";
const MODEL_HEIGHT = 2.86;
const MODEL_TARGET: [number, number, number] = [0, 0.03, 0];

interface ModelFrame {
  depth: number;
  floorY: number;
  height: number;
  width: number;
}

const DEFAULT_FRAME: ModelFrame = {
  depth: 1.3,
  floorY: -MODEL_HEIGHT / 2,
  height: MODEL_HEIGHT,
  width: 1.35,
};

interface AvatarModelProps {
  onFrameChange: (frame: ModelFrame) => void;
}

function AvatarModel({ onFrameChange }: AvatarModelProps) {
  const { scene } = useLoader(GLTFLoader, MODEL_PATH);

  const modelTransform = useMemo(() => {
    scene.updateMatrixWorld(true);

    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const shouldLiftZAxis = size.z > size.y * 1.18;
    const rotation: [number, number, number] = shouldLiftZAxis
      ? [-Math.PI / 2, 0, -0.18]
      : [0, -0.18, 0];

    const measuringScene = scene.clone(true);
    measuringScene.position.set(-center.x, -center.y, -center.z);

    const measuringGroup = new Group();
    measuringGroup.rotation.set(...rotation);
    measuringGroup.add(measuringScene);
    measuringGroup.updateMatrixWorld(true);

    const visualBox = new Box3().setFromObject(measuringGroup);
    const visualSize = visualBox.getSize(new Vector3());
    const visualCenter = visualBox.getCenter(new Vector3());
    const scale = MODEL_HEIGHT / (visualSize.y || 1);

    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return {
      frame: {
        depth: visualSize.z * scale,
        floorY: (visualBox.min.y - visualCenter.y) * scale,
        height: visualSize.y * scale,
        width: visualSize.x * scale,
      },
      groupPosition: [
        -visualCenter.x * scale,
        -visualCenter.y * scale,
        -visualCenter.z * scale,
      ] as [number, number, number],
      position: [-center.x, -center.y, -center.z] as [number, number, number],
      rotation,
      scale,
    };
  }, [scene]);

  useEffect(() => {
    onFrameChange(modelTransform.frame);
  }, [modelTransform.frame, onFrameChange]);

  return (
    <group
      position={modelTransform.groupPosition}
      rotation={modelTransform.rotation}
      scale={modelTransform.scale}
    >
      <primitive
        object={scene}
        position={modelTransform.position}
        dispose={null}
      />
    </group>
  );
}

function ModelLoadingMesh() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.72, 0.008, 12, 96]} />
      <meshBasicMaterial color="#00e5ff" transparent opacity={0.72} />
    </mesh>
  );
}

function getCameraDistance(frame: ModelFrame, width: number, height: number) {
  const aspect = width / Math.max(height, 1);
  const verticalFov = (36 * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const isMobile = width < 640;
  const margin = isMobile ? 1.22 : width < 1024 ? 1.16 : 1.08;
  const distanceForHeight =
    (frame.height * margin * 0.5) / Math.tan(verticalFov / 2);
  const distanceForWidth =
    (frame.width * margin * 0.5) / Math.tan(horizontalFov / 2);

  return Math.max(distanceForHeight, distanceForWidth, 3.25);
}

interface CameraControlsProps {
  frame: ModelFrame;
}

function CameraControls({ frame }: CameraControlsProps) {
  const { camera, gl, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const controls = new OrbitControlsImpl(camera, gl.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = true;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera;
    const distance = getCameraDistance(frame, size.width, size.height);
    const isMobile = size.width < 640;
    const isWide = size.width >= 1024;

    perspectiveCamera.fov = 36;
    perspectiveCamera.position.set(
      isWide ? -0.12 : 0,
      isMobile ? 0.08 : 0.12,
      distance,
    );
    perspectiveCamera.near = 0.1;
    perspectiveCamera.far = 100;
    perspectiveCamera.lookAt(...MODEL_TARGET);
    perspectiveCamera.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.minDistance = distance * 0.68;
      controls.maxDistance = distance * 1.72;
      controls.target.set(...MODEL_TARGET);
      controls.update();
    }
  }, [camera, frame, size.height, size.width]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

interface StudioFloorProps {
  frame: ModelFrame;
}

function StudioFloor({ frame }: StudioFloorProps) {
  const floorRadius = Math.max(frame.width, frame.depth, 1.45);

  return (
    <group>
      <mesh
        position={[0, frame.floorY - 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[floorRadius * 0.78, 72]} />
        <meshBasicMaterial color="#111f20" transparent opacity={0.72} />
      </mesh>
      <mesh
        position={[0, frame.floorY - 0.022, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[floorRadius * 0.76, floorRadius * 0.8, 96]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function ShowroomBacklight({ frame }: StudioFloorProps) {
  return (
    <group>
      <mesh position={[0, 0.06, -1.18]}>
        <planeGeometry
          args={[
            Math.max(frame.width * 1.9, 2.55),
            Math.max(frame.height * 1.12, 3.2),
          ]}
        />
        <meshBasicMaterial color="#12343a" transparent opacity={0.34} />
      </mesh>
      <mesh position={[0, 0.12, -1.14]}>
        <ringGeometry args={[1.08, 1.1, 96]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

export default function FashionPreview3D() {
  const [frame, setFrame] = useState<ModelFrame>(DEFAULT_FRAME);

  return (
    <Canvas
      aria-label="Interactive 3D fashion preview"
      camera={{ position: [0, 0.14, 5], fov: 36 }}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      dpr={[1, 1.5]}
      fallback={
        <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center text-sm font-semibold text-slate-300">
          3D preview is not available on this device.
        </div>
      }
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows
    >
      <color attach="background" args={["#101314"]} />
      <ambientLight intensity={1.65} />
      <hemisphereLight
        color="#c3f5ff"
        groundColor="#161616"
        intensity={0.75}
      />
      <directionalLight
        castShadow
        color="#ffffff"
        intensity={3.2}
        position={[3.4, 4.8, 4.2]}
      />
      <directionalLight
        color="#12dff3"
        intensity={2.1}
        position={[-3.4, 2.4, -2.4]}
      />
      <spotLight
        angle={0.42}
        color="#c3f5ff"
        intensity={2.8}
        penumbra={0.55}
        position={[-2.8, 3.2, 3.4]}
      />
      <pointLight color="#12dff3" intensity={3.1} position={[-2.8, 1.8, 2.2]} />
      <pointLight color="#ffeac0" intensity={1.4} position={[2.4, 1.4, 1.8]} />
      <pointLight color="#00e5ff" intensity={2.4} position={[0.6, 1.7, -2.2]} />

      <Suspense fallback={<ModelLoadingMesh />}>
        <ShowroomBacklight frame={frame} />
        <AvatarModel onFrameChange={setFrame} />
        <StudioFloor frame={frame} />
      </Suspense>

      <CameraControls frame={frame} />
    </Canvas>
  );
}

useLoader.preload(GLTFLoader, MODEL_PATH);

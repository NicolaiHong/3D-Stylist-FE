import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Box3, Group, Mesh, PerspectiveCamera, Vector3 } from "three";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useI18n } from "../../i18n/useI18n";

const MODEL_PATH = "/models/fashionboy.glb";
const MODEL_HEIGHT = 2.86;
const MODEL_TARGET: [number, number, number] = [0, 0.02, 0];

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
    <mesh position={[0, 0.24, 0]} rotation={[0.4, 0.6, 0]}>
      <octahedronGeometry args={[0.13, 0]} />
      <meshBasicMaterial color="#9cf0ff" transparent opacity={0.74} />
    </mesh>
  );
}

function getCameraDistance(frame: ModelFrame, width: number, height: number) {
  const aspect = width / Math.max(height, 1);
  const verticalFov = (36 * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const isMobile = width < 640;
  const margin = isMobile ? 1.38 : width < 1024 ? 1.32 : 1.26;
  const distanceForHeight =
    (frame.height * margin * 0.5) / Math.tan(verticalFov / 2);
  const distanceForWidth =
    (frame.width * margin * 0.5) / Math.tan(horizontalFov / 2);

  return Math.max(distanceForHeight, distanceForWidth, 3.8);
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
      isWide ? -0.1 : 0,
      isMobile ? 0.06 : 0.1,
      distance,
    );
    perspectiveCamera.near = 0.1;
    perspectiveCamera.far = 100;
    perspectiveCamera.lookAt(...MODEL_TARGET);
    perspectiveCamera.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.minDistance = distance * 0.76;
      controls.maxDistance = distance * 1.78;
      controls.target.set(...MODEL_TARGET);
      controls.update();
    }
  }, [camera, frame, size.height, size.width]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

interface ContactFloorProps {
  frame: ModelFrame;
}

function ContactShadowFloor({ frame }: ContactFloorProps) {
  const floorSize = Math.max(frame.width, frame.depth, 1.6) * 2.5;

  return (
    <mesh
      receiveShadow
      position={[0, frame.floorY - 0.025, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[floorSize, floorSize]} />
      <shadowMaterial color="#000000" transparent opacity={0.24} />
    </mesh>
  );
}

export default function FashionPreview3D() {
  const { t } = useI18n();
  const [frame, setFrame] = useState<ModelFrame>(DEFAULT_FRAME);

  return (
    <Canvas
      aria-label={t("landing.preview.toolbar")}
      camera={{ position: [0, 0.1, 5.8], fov: 36 }}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      dpr={[1, 1.5]}
      fallback={
        <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center text-sm font-semibold text-slate-300">
          {t("landing.preview.error")}
        </div>
      }
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      shadows
    >
      <ambientLight intensity={1.35} />
      <hemisphereLight
        color="#c3f5ff"
        groundColor="#161616"
        intensity={0.7}
      />
      <directionalLight
        castShadow
        color="#ffffff"
        intensity={2.7}
        position={[3.4, 4.8, 4.2]}
      />
      <directionalLight
        color="#12dff3"
        intensity={1.4}
        position={[-3.4, 2.4, -2.4]}
      />
      <spotLight
        angle={0.42}
        color="#c3f5ff"
        intensity={2.1}
        penumbra={0.55}
        position={[-2.8, 3.2, 3.4]}
      />
      <pointLight
        color="#12dff3"
        intensity={1.8}
        position={[-2.8, 1.8, 2.2]}
      />
      <pointLight
        color="#ffeac0"
        intensity={1.0}
        position={[2.4, 1.4, 1.8]}
      />
      <pointLight
        color="#00e5ff"
        intensity={1.4}
        position={[0.6, 1.7, -2.2]}
      />

      <Suspense fallback={<ModelLoadingMesh />}>
        <AvatarModel onFrameChange={setFrame} />
        <ContactShadowFloor frame={frame} />
      </Suspense>

      <CameraControls frame={frame} />
    </Canvas>
  );
}

useLoader.preload(GLTFLoader, MODEL_PATH);

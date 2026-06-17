import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Box3, Group, Mesh, PerspectiveCamera, Vector3 } from "three";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AlertTriangle, Box } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";

const MODEL_HEIGHT = 2.95;
const VIEWER_FOV = 37;

interface ModelFrame {
  center: [number, number, number];
  depth: number;
  floorY: number;
  height: number;
  target: [number, number, number];
  width: number;
}

const DEFAULT_FRAME: ModelFrame = {
  center: [0, 0, 0],
  depth: 1.4,
  floorY: -MODEL_HEIGHT / 2,
  height: MODEL_HEIGHT,
  target: [0, 0.16, 0],
  width: 1.4,
};

interface GeneratedModelProps {
  modelUrl: string;
  onFrameChange: (frame: ModelFrame) => void;
}

function GeneratedModel({
  modelUrl,
  onFrameChange,
}: GeneratedModelProps) {
  const { scene } = useLoader(GLTFLoader, modelUrl);

  const modelTransform = useMemo(() => {
    const renderScene = cloneSkeleton(scene);
    renderScene.updateMatrixWorld(true);

    const sourceBox = new Box3().setFromObject(renderScene);
    const sourceSize = sourceBox.getSize(new Vector3());
    const sourceCenter = sourceBox.getCenter(new Vector3());
    const shouldLiftZAxis = sourceSize.z > sourceSize.y * 1.18;
    const rotation: [number, number, number] = shouldLiftZAxis
      ? [-Math.PI / 2, 0, -0.12]
      : [0, -0.12, 0];

    const measuringScene = cloneSkeleton(scene);
    measuringScene.position.set(
      -sourceCenter.x,
      -sourceCenter.y,
      -sourceCenter.z,
    );

    const measuringGroup = new Group();
    measuringGroup.rotation.set(...rotation);
    measuringGroup.add(measuringScene);
    measuringGroup.updateMatrixWorld(true);

    const visualBox = new Box3().setFromObject(measuringGroup);
    const visualSize = visualBox.getSize(new Vector3());
    const visualCenter = visualBox.getCenter(new Vector3());
    const safeVisualHeight = visualSize.y || 1;
    const scale = MODEL_HEIGHT / safeVisualHeight;
    const centeredMinY = (visualBox.min.y - visualCenter.y) * scale;
    const centeredHeight = safeVisualHeight * scale;
    const targetY = centeredMinY + centeredHeight * 0.48;

    renderScene.traverse((object) => {
      const mesh = object as Mesh;

      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return {
      frame: {
        center: [0, 0, 0] as [number, number, number],
        depth: visualSize.z * scale,
        floorY: centeredMinY,
        height: centeredHeight,
        target: [0, targetY, 0] as [number, number, number],
        width: visualSize.x * scale,
      },
      groupPosition: [
        -visualCenter.x * scale,
        -visualCenter.y * scale,
        -visualCenter.z * scale,
      ] as [number, number, number],
      model: renderScene,
      position: [
        -sourceCenter.x,
        -sourceCenter.y,
        -sourceCenter.z,
      ] as [number, number, number],
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
        dispose={null}
        object={modelTransform.model}
        position={modelTransform.position}
      />
    </group>
  );
}

function ModelLoadingMesh() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.72, 0.008, 12, 96]} />
      <meshBasicMaterial color="#00e5ff" opacity={0.72} transparent />
    </mesh>
  );
}

function getCameraDistance(frame: ModelFrame, width: number, height: number) {
  const aspect = width / Math.max(height, 1);
  const verticalFov = (VIEWER_FOV * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const shortViewportPadding = height < 500 ? 0.08 : 0;
  const margin =
    (width < 640 ? 1.28 : width < 1024 ? 1.22 : 1.14) +
    shortViewportPadding;
  const distanceForHeight =
    (frame.height * margin * 0.5) / Math.tan(verticalFov / 2);
  const distanceForWidth =
    (frame.width * margin * 0.5) / Math.tan(horizontalFov / 2);
  const depthAllowance = Math.max(frame.depth * 0.22, 0.14);

  return Math.max(distanceForHeight, distanceForWidth, 2.8) + depthAllowance;
}

function CameraControls({ frame }: { frame: ModelFrame }) {
  const { camera, gl, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const controls = new OrbitControlsImpl(camera, gl.domElement);
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
    const target = new Vector3(...frame.target);

    perspectiveCamera.fov = VIEWER_FOV;
    perspectiveCamera.position.set(
      target.x,
      target.y + (size.width >= 1024 ? 0.01 : 0.005),
      distance,
    );
    perspectiveCamera.near = 0.1;
    perspectiveCamera.far = 100;
    perspectiveCamera.lookAt(target);
    perspectiveCamera.updateProjectionMatrix();

    const controls = controlsRef.current;

    if (controls) {
      controls.minDistance = Math.max(distance * 0.38, 1.65);
      controls.maxDistance = distance * 2.65;
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, frame, size.height, size.width]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

function ViewerEnvironment({ frame }: { frame: ModelFrame }) {
  const floorWidth = Math.max(frame.width * 1.28, 1.5);
  const floorDepth = Math.max(frame.depth * 0.64, 0.72);
  const shadowWidth = Math.max(frame.width * 0.76, 0.98);
  const shadowDepth = Math.max(frame.depth * 0.38, 0.44);

  return (
    <>
      <mesh
        position={[frame.center[0], frame.floorY - 0.06, frame.center[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[floorWidth, floorDepth, 1]}
      >
        <circleGeometry args={[1, 80]} />
        <meshBasicMaterial
          color="#0f191b"
          depthWrite={false}
          opacity={0.62}
          transparent
        />
      </mesh>
      <mesh
        position={[frame.center[0], frame.floorY - 0.055, frame.center[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[floorWidth * 1.04, floorDepth * 1.04, 1]}
      >
        <ringGeometry args={[0.82, 0.84, 96]} />
        <meshBasicMaterial
          color="#00e5ff"
          depthWrite={false}
          opacity={0.11}
          transparent
        />
      </mesh>
      <mesh
        position={[frame.center[0], frame.floorY - 0.038, frame.center[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[shadowWidth, shadowDepth, 1]}
      >
        <circleGeometry args={[1, 80]} />
        <meshBasicMaterial
          color="#02090b"
          depthWrite={false}
          opacity={0.2}
          transparent
        />
      </mesh>
      <mesh
        receiveShadow
        position={[frame.center[0], frame.floorY - 0.075, frame.center[2] - 0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[Math.max(frame.width * 2.8, 4.6), 5.4]} />
        <shadowMaterial opacity={0.08} transparent />
      </mesh>
    </>
  );
}

interface ViewerSceneProps {
  modelUrl: string;
  onReady: () => void;
}

function ViewerScene({ modelUrl, onReady }: ViewerSceneProps) {
  const [frame, setFrame] = useState(DEFAULT_FRAME);
  const handleFrameChange = useCallback(
    (nextFrame: ModelFrame) => {
      setFrame(nextFrame);
      onReady();
    },
    [onReady],
  );

  useEffect(() => {
    setFrame(DEFAULT_FRAME);
  }, [modelUrl]);

  return (
    <>
      <ambientLight intensity={1} />
      <hemisphereLight
        color="#c3f5ff"
        groundColor="#121819"
        intensity={0.64}
      />
      <directionalLight
        castShadow
        color="#ffffff"
        intensity={2.55}
        position={[3.2, 5.4, 4.6]}
      />
      <directionalLight
        color="#12dff3"
        intensity={0.62}
        position={[-3.6, 2.8, -2.6]}
      />
      <pointLight color="#12dff3" intensity={0.78} position={[-2.8, 1.9, 2.4]} />
      <pointLight color="#ffeac0" intensity={0.55} position={[2.3, 1.5, 2]} />

      <Suspense fallback={<ModelLoadingMesh />}>
        <ViewerEnvironment frame={frame} />
        <GeneratedModel
          modelUrl={modelUrl}
          onFrameChange={handleFrameChange}
        />
      </Suspense>

      <CameraControls frame={frame} />
    </>
  );
}

interface ViewerErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
}

interface ViewerErrorBoundaryState {
  hasError: boolean;
}

class ViewerErrorBoundary extends Component<
  ViewerErrorBoundaryProps,
  ViewerErrorBoundaryState
> {
  state: ViewerErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ViewerErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    // The fallback intentionally avoids logging signed viewer URLs or loader details.
    this.props.onError();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface ViewerFallbackProps {
  onRetry?: () => void;
  onShow2d: () => void;
  unavailable?: boolean;
}

function ViewerFallback({
  onRetry,
  onShow2d,
  unavailable = false,
}: ViewerFallbackProps) {
  const { t } = useI18n();

  return (
    <div
      className="flex h-full min-h-[360px] flex-col items-center justify-center p-8 text-center"
      role="alert"
    >
      <AlertTriangle className="h-10 w-10 text-[#ffeac0]" />
      <h3 className="mt-4 font-display text-2xl font-semibold text-white">
        {unavailable
          ? t("studio.viewer.webglUnavailable")
          : t("studio.viewer.error")}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
        {t("studio.viewer.errorBody")}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {onRetry ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#00e5ff]/45 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={onRetry}
          >
            {t("common.retry")}
          </button>
        ) : null}
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#3b494c] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
          type="button"
          onClick={onShow2d}
        >
          {t("studio.view.2d")}
        </button>
      </div>
    </div>
  );
}

function CanvasUnavailable({
  onShow2d,
  onUnavailable,
}: {
  onShow2d: () => void;
  onUnavailable: () => void;
}) {
  useEffect(() => {
    onUnavailable();
  }, [onUnavailable]);

  return <ViewerFallback unavailable onShow2d={onShow2d} />;
}

interface StudioModelViewerProps {
  modelUrl: string;
  onShow2d: () => void;
}

export default function StudioModelViewer({
  modelUrl,
  onShow2d,
}: StudioModelViewerProps) {
  const { t } = useI18n();
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setHasError(false);
    setIsReady(false);
    setIsUnavailable(false);
  }, [modelUrl, retryKey]);

  const handleRetry = useCallback(() => {
    useLoader.clear(GLTFLoader, modelUrl);
    setHasError(false);
    setIsUnavailable(false);
    setRetryKey((currentKey) => currentKey + 1);
  }, [modelUrl]);

  return (
    <div className="studio-model-viewer relative h-full min-h-[380px] w-full overflow-hidden">
      <ViewerErrorBoundary
        fallback={
          <ViewerFallback onRetry={handleRetry} onShow2d={onShow2d} />
        }
        key={`${modelUrl}:${retryKey}`}
        onError={() => setHasError(true)}
      >
        <Canvas
          aria-label={t("studio.viewer.aria")}
          camera={{ position: [0, 0.2, 5], fov: VIEWER_FOV }}
          className="relative z-10 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          dpr={[1, 1.5]}
          fallback={
            <CanvasUnavailable
              onShow2d={onShow2d}
              onUnavailable={() => setIsUnavailable(true)}
            />
          }
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          shadows
        >
          <ViewerScene modelUrl={modelUrl} onReady={() => setIsReady(true)} />
        </Canvas>
      </ViewerErrorBoundary>

      {!isReady && !hasError && !isUnavailable ? (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#101314]/72 px-6 text-center"
          role="status"
        >
          <span className="flex flex-col items-center gap-3 text-sm font-semibold text-[#c3f5ff]">
            <Box className="h-8 w-8 animate-pulse text-[#00e5ff]" />
            {t("studio.viewer.loading")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

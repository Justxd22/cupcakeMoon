
import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
// import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
// import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';



const textureLoader = new THREE.TextureLoader();

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

function createGradientTexture() {
    const size = 512; // Size of the texture
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');

    // Create a radial gradient
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(0, 0, 10, 1)'); // Dark color for space
    gradient.addColorStop(1, 'rgba(7, 7, 40, 1)'); // Slightly lighter color

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    return new THREE.Texture(canvas);
}


async function init() {
    const earthMap = "/res/earth_map.jpeg";
    const cloudMap = "/res/cloud.png";
    const atmosVertex = await loadShader('/res/shaders/atmosVertex.glsl');
    const atmosFrag = await loadShader('/res/shaders/atmosFrag.glsl');
    const Frag = await loadShader('/res/shaders/frag.glsl');
    const vertex = await loadShader('/res/shaders/vertex.glsl');
    const gradientTexture = createGradientTexture();

    const gui = new GUI();
    const stats = new Stats();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(125, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5, // Bloom strength
        .3, // Bloom radius
        .4 // Bloom threshold
    );

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    gradientTexture.needsUpdate = true;
    camera.position.set(0.5, 0, 3);
    const controls = new OrbitControls(camera, renderer.domElement);

    // scene.background = gradientTexture;
    renderer.shadowMap.enabled = true;
    controls.enableDamping = true;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
    renderer.debug.checkShaderErrors = true;

    controls.dampingFactor = 0.05;
    controls.maxDistance = 12;
    controls.minDistance = 2;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.75;

    document.body.style.margin = 0;
    document.body.style.overflow = "hidden";
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(stats.dom);

    const gridHelper = new THREE.GridHelper(20, 30);
    gridHelper.visible = false;
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const axis = new THREE.AxesHelper(1.75);
    axis.visible = false;
    scene.add(axis);

    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(-5, 2, 0);
    scene.add(pointLight);

    const lensFlaresImg = "/res/flare.png";
    const lensflareTexture = textureLoader.load(lensFlaresImg);
    const lensflareColor = new THREE.Color(0xffffff);
    const lensflare = new Lensflare();
    const lensflareElement = new LensflareElement(
        lensflareTexture,
        300 * pointLight.intensity,
        0,
        lensflareColor
    );

    lensflare.addElement(lensflareElement);
    pointLight.add(lensflare);

    const earth = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: Frag,
            uniforms: {
                globeTexture: { value: new THREE.TextureLoader().load(earthMap) },
                bumpMap: { value: new THREE.TextureLoader().load(earthMap) },
                bumpScale: { value: 0.02 },
                metalness: { value: 0.1 },
                roughness: { value: 0.7 },
                lightPosition: { value: new THREE.Vector3(-5, 2, 0) },
                lightColor: { value: new THREE.Color(0xffffff) },
                lightIntensity: { value: pointLight.intensity },
                viewPosition: { value: camera.position }
            }
        }),
    );
    scene.add(earth);

    const atmos = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.ShaderMaterial({
            vertexShader: atmosVertex,
            fragmentShader: atmosFrag,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
        })
    );

    atmos.scale.set(1.2, 1.2, 1.2);
    scene.add(atmos);


    const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.MeshStandardMaterial({
            map: { value: new THREE.TextureLoader().load(cloudMap) },
            bumpScale: 0.015,
            transparent: true,
            depthWrite: false,
            opacity: 1
        })
    );
    cloud.scale.set(1.045, 1.045, 1.045);
    scene.add(cloud);

    const pointsCount = 1500;
    const pointsGeo = new THREE.BufferGeometry();
    const pointsPos = new Float32Array(pointsCount * 3);

    for (let i = 0; i < pointsCount * 3; i++) {
        pointsPos[i] = (Math.random() - 0.5) * 15;
    }
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(pointsPos, 3));

    const pointsMat = new THREE.PointsMaterial({
        size: 0.015,
        sizeAttenuation: true,
        color: 0xffffff
    });

    const points = new THREE.Points(pointsGeo, pointsMat);
    points.visible = true;
    scene.add(points);

    gui.add(gridHelper, "visible").name("Grid Helper");
    gui.add(points, "visible").name("Points shi");
    gui.add(axis, "visible").name("Axis Helper");
    gui.add(controls, "autoRotate").name("Auto Rotate Scene");

    const sunFolder = gui.addFolder("Sun");
    sunFolder
        .add(pointLight, "intensity")
        .min(0)
        .max(2)
        .step(0.01)
        .name("Sun Intensity")
        .onChange((val) => {
            lensflareElement.size = val * 300;
        });
    sunFolder.add(pointLight.position, "x").min(-5).max(5).step(0.01).name("Sun X");
    sunFolder.add(pointLight.position, "y").min(-5).max(5).step(0.01).name("Sun Y");
    sunFolder.add(pointLight.position, "z").min(-5).max(5).step(0.01).name("Sun Z");

    const earthFolder = gui.addFolder("Earth");
    earthFolder
        .add(earth.material.uniforms.metalness, "value")
        .min(0)
        .max(1)
        .step(0.01)
        .name("Earth Metalness");

    earthFolder
        .add(earth.material.uniforms.roughness, "value")
        .min(0)
        .max(1)
        .step(0.01)
        .name("Earth Roughness");

    earthFolder
        .add(earth.material.uniforms.bumpScale, "value")
        .min(0)
        .max(0.05)
        .step(0.0001)
        .name("Earth Bump Scale");
    earthFolder
        .add(earth.material.uniforms.lightIntensity, "value")
        .min(0)
        .max(10) // Adjust this max value as needed
        .step(0.1)
        .name("Light Intensity");
    earthFolder.add(earth.material, "wireframe").name("Earth Wireframe");
    earthFolder
        .add(cloud.material, "opacity")
        .min(0)
        .max(1)
        .step(0.01)
        .name("Cloud Opacity");
    earthFolder
        .add(cloud.scale, "x")
        .min(1.01)
        .max(1.1)
        .step(0.001)
        .name("Cloud Distance")
        .onChange((val) => {
            cloud.scale.y = val;
            cloud.scale.z = val;
        });
    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const toogleFullScreen = () => {
        const fullscreenElement =
            document.fullscreenElement || document.webkitFullscreenElement;

        if (!fullscreenElement) {
            if (document.body.requestFullscreen) {
                document.body.requestFullscreen();
            } else if (document.body.webkitRequestFullscreen) {
                document.body.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    };

    gui.add({ fullscreen: toogleFullScreen }, "fullscreen").name("Toggle Fullscreen");
    const clock = new THREE.Clock();

    const animate = () => {
        stats.begin();
        const elapsedTime = clock.getElapsedTime();
        //   console.log("ELPPP", elapsedTime);

        const lightPositionView = new THREE.Vector3();
        lightPositionView.copy(pointLight.position).applyMatrix4(camera.matrixWorldInverse);

        earth.material.uniforms.lightPosition.value = lightPositionView;

        earth.rotation.y = elapsedTime / 10;
        cloud.rotation.y = elapsedTime / 10;
        controls.update();
        renderer.render(scene, camera);

        // composer.render();
        stats.end();
        requestAnimationFrame(animate);
    };

    animate();

}


init();
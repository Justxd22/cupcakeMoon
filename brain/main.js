import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { gsap } from "gsap";

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

function createGradientTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');

    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // Updated color stops using Three.js ColorManagement
    const darkColor = new THREE.Color(0, 0, 10 / 255);
    const lightColor = new THREE.Color(7 / 255, 7 / 255, 70 / 255);

    darkColor.convertSRGBToLinear();
    lightColor.convertSRGBToLinear();

    gradient.addColorStop(0, darkColor.getStyle()); // Dark color for space
    gradient.addColorStop(1, lightColor.getStyle()); // Slightly lighter color

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}


async function init() {
    const clock = new THREE.Clock();
    const textureLoader = new THREE.TextureLoader();
    const earthMap = "./res/earth_map.jpeg";
    const cloudMap = "./res/cloud.png";
    const cloudTexture = textureLoader.load(cloudMap);
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    const atmosVertex = await loadShader('./res/shaders/atmosVertex.glsl');
    const atmosFrag = await loadShader('./res/shaders/atmosFrag.glsl');
    const Frag = await loadShader('./res/shaders/frag.glsl');
    const vertex = await loadShader('./res/shaders/vertex.glsl');

    const ttfLoader = new TTFLoader();
    const fontData = await new Promise((resolve) => {
        ttfLoader.load('./res/fonts/Computerfont.ttf', resolve);
    });
    const font = new Font(fontData);


    const gui = new GUI();
    const stats = new Stats();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(125, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;




    camera.position.set(0.5, 0, 3);
    const controls = new OrbitControls(camera, renderer.domElement);

    renderer.shadowMap.enabled = true;
    controls.enableDamping = true;

    // renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.debug.checkShaderErrors = true;

    controls.dampingFactor = 0.05;
    controls.maxDistance = 12;
    controls.minDistance = 2;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1;

    document.body.style.margin = 0;
    document.body.style.overflow = "hidden";
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(stats.dom);

    const gradientTexture = createGradientTexture();
    gradientTexture.needsUpdate = true;
    scene.background = gradientTexture;

    const gridHelper = new THREE.GridHelper(20, 30);
    gridHelper.visible = false;
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 3.7);
    scene.add(ambientLight);

    const axis = new THREE.AxesHelper(1.75);
    axis.visible = false;
    scene.add(axis);

    const pointLight = new THREE.PointLight(0xffffff, 5);
    pointLight.position.set(-5, 2, 0);
    scene.add(pointLight);

    const lensFlaresImg = "./res/flare.png";
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


    const textList = ["Hey", "Cosmic", "Star", "Pretttty"];
    let currentIndex = 0;
    let currentText = "";
    let isFadingOut = false;

    let textGeometry = new TextGeometry('Cosmic', {
        font: font,
        size: 1,
        depth: 0.1,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.01,
        bevelOffset: 0,
        bevelSegments: 5,
    });
    textGeometry.computeBoundingBox();
    textGeometry.center();

    const textMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x00e1ff,
        roughness: 0.5,
        transmission: 1,
        transparent: true,
        thickness: 1,
    });
    let textMesh = new THREE.Mesh(textGeometry, textMaterial);


    const strokeGroup = new THREE.Group();
    strokeGroup.userData.update = (t) => {
        strokeGroup.children.forEach((child) => {
            child.userData.update?.(t);
        });

    }
    const lineMaterial = new LineMaterial({
        color: 0xd4a8ff,
        linewidth: 3,
        dashed: true,
        gapSize: .1,
        dashSize: 2,
        dashOffset: 0.0,
    });

    
    const textGroup = new THREE.Group();

    // Set initial position for the text group
    textGroup.position.set(0, 0, 0);
    
    
    function typeText(text, index = 0) {
        if (index < text.length) {
            currentText += text[index];
            updateTextAndStroke(currentText);
            setTimeout(() => typeText(text, index + 1), 100); // Typing speed
        } else {
            // After typing, start fading out the text
            setTimeout(fadeOutText, 1500);  // Delay before fade starts
        }
    }
    
    function updateTextAndStroke(newText) {
        // Update text geometry
        // textGeometry.computeBoundingBox();
        // textGeometry.center();
        strokeGroup.clear(); // Clear old strokes
        textGroup.clear(); // Clear old strokes
        
        textGeometry = new TextGeometry(newText, {
            font: font,
            size: 1,
            depth: 0.1,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.08,
            bevelSize: 0.01,
            bevelOffset: 0,
            bevelSegments: 5,
        });
        textGeometry.computeBoundingBox();
        textGeometry.center();
    

        textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(0, 1.8, 0);
        // textMesh.rotation.y = 5.5;  // Rotate the text slightly if needed
    
        // Update stroke geometry
        const shapes = font.generateShapes(newText, 1);
        shapes.forEach((s) => {
            let points = s.getPoints();
            let points3d = [];
            points.forEach((p) => {
                points3d.push(p.x, p.y, 0);
            });
            
            const lineGeo = new LineGeometry();
            lineGeo.setPositions(points3d);
            const strokeMesh = new Line2(lineGeo, lineMaterial);
            strokeMesh.computeLineDistances();
            strokeMesh.userData.update = (t) => {
                lineMaterial.dashOffset = t * .1;
            }
            strokeGroup.add(strokeMesh);
            
            if (s.holes?.length > 0) {
                s.holes.forEach((h) => {
                    let points = h.getPoints();
                    let points3d = [];
                    points.forEach((p) => {
                        points3d.push(p.x, p.y, 0);
                    });
                    const lineGeo = new LineGeometry();
                    lineGeo.setPositions(points3d);
                    const strokeMesh = new Line2(lineGeo, lineMaterial);
                    strokeMesh.computeLineDistances();
                    strokeMesh.userData.update = (t) => {
                        lineMaterial.dashOffset = t * .1;
                    }
                    strokeGroup.add(strokeMesh);
                });
            }
        });
        
        // Center the stroke
        const boundingBox = new THREE.Box3();
        strokeGroup.children.forEach((child) => {
            boundingBox.union(child.geometry.boundingBox);
        });
        const center = boundingBox.getCenter(new THREE.Vector3());
        strokeGroup.children.forEach((child) => {
            child.position.sub(center);
        });
        strokeGroup.position.set(0, 1.8, 0.15);
        textGroup.add(textMesh);
        textGroup.add(strokeGroup);
        textGroup.rotation.y = - clock.getElapsedTime() * 0.1066666667;
        scene.add(textGroup);
    }
    

    function fadeOutText() {
        isFadingOut = true;
        gsap.to(textMesh.material, { 
            opacity: 1, 
            duration: 1,  // Fade-out duration
            onComplete: () => {
                currentIndex = (currentIndex + 1) % textList.length;  // Move to the next word
                currentText = "";  // Reset current text
                updateTextAndStroke(currentText);
                textMesh.material.opacity = 1;  // Reset opacity for the next word
                typeText(textList[currentIndex]);  // Start typing the next word
            }
        });
    }

    typeText(textList[currentIndex]);

    const earth = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: Frag,
            uniforms: {
                globeTexture: { value: textureLoader.load(earthMap) },
                bumpMap: { value: textureLoader.load(earthMap) },
                bumpScale: { value: 0.02 },
                metalness: { value: 0.1 },
                roughness: { value: 0.7 },
                lightPosition: { value: new THREE.Vector3(-5, 2, 0) },
                lightColor: { value: new THREE.Color(0xffffff) },
                lightIntensity: { value: 1.5 },
                viewPosition: { value: camera.position }
            }
        }),
    );

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


    const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.MeshStandardMaterial({
            map: cloudTexture,
            bumpScale: 0.015,
            transparent: true,
            depthWrite: false,
            opacity: 1
        })
    );
    cloud.scale.set(1.045, 1.045, 1.045);

    scene.add(earth);
    scene.add(atmos);
    scene.add(cloud);

    const pointsCount = 1500;
    const pointsGeo = new THREE.BufferGeometry();
    const pointsPos = new Float32Array(pointsCount * 3);
    const pointsSizes = new Float32Array(pointsCount);

    for (let i = 0; i < pointsCount; i++) {
        pointsPos[i * 3] = (Math.random() - 0.5) * 15;
        pointsPos[i * 3 + 1] = (Math.random() - 0.5) * 15;
        pointsPos[i * 3 + 2] = (Math.random() - 0.5) * 15;
        pointsSizes[i] = Math.random() * 0.02 + 0.005; // Random size between 0.005 and 0.025
    }
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(pointsPos, 3));
    pointsGeo.setAttribute("size", new THREE.BufferAttribute(pointsSizes, 1));

    const pointsMat = new THREE.PointsMaterial(
        {
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
    gui.add(ambientLight, "intensity").min(0)
        .max(10) // Adjust this max value as needed
        .step(0.1)
        .name("AMP Light Intensity");;

    const textFolder = gui.addFolder('3D Text');

    textFolder.addColor({ color: lineMaterial.color.getHex() }, 'color')
        .onChange((value) => lineMaterial.color.set(value))
        .name('color');
    textFolder.addColor({ color: textMaterial.color.getHex() }, 'color')
        .onChange((value) => textMaterial.color.set(value))
        .name('color');

    textFolder.add(textGroup.position, 'x', -5, 5).name('Text X');
    textFolder.add(textGroup.position, 'y', -5, 5).name('Text Y');
    textFolder.add(textGroup.position, 'z', -5, 5).name('Text Z');
    textFolder.add(textGroup.rotation, 'y', 0, Math.PI * 2).name('Text Rotation Y');

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

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.body.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    gui.add({ fullscreen: toggleFullScreen }, "fullscreen").name("Toggle Fullscreen");

    const animate = () => {
        stats.begin();
        const elapsedTime = clock.getElapsedTime();
        //   console.log("ELPPP", elapsedTime, deltaTime);

        const lightPositionView = new THREE.Vector3();
        lightPositionView.copy(pointLight.position).applyMatrix4(camera.matrixWorldInverse);
        // textMesh.lookAt(camera.position);
        earth.material.uniforms.lightPosition.value = lightPositionView;

        earth.rotation.y = elapsedTime / 10;
        cloud.rotation.y = elapsedTime / 10;

        // textGroup.rotation.y = - elapsedTime * 0.08;
        strokeGroup.userData.update(elapsedTime * 4);

        controls.update();
        renderer.render(scene, camera);
        stats.end();
        requestAnimationFrame(animate);
    };

    animate();
}

init();
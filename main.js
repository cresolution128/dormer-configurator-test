import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

class RoofViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.roofModel = null;
        this.dormerModel = null;
        this.originalRoofHeight = null;
        this.originalDormerHeight = null;
        this.roofHeightScale = 1;
        
        this.init();
        this.setupControls();
        this.animate();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 20;
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        const gridHelper = new THREE.GridHelper(20, 20);
        this.scene.add(gridHelper);
        
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
        
        this.loadRoof();
        this.loadDormer();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }

    loadRoof() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(dracoLoader);
        
        loader.load(
            './models/roof.glb',
            (gltf) => {
                this.roofModel = gltf.scene;
                this.scene.add(this.roofModel);
                this.storeOriginalHeights();
                this.positionDormer();
                this.fitCameraToModel();
                this.hideLoading();
            },
            undefined,
            (error) => {
                console.error('Error loading roof.glb, trying alternative formats:', error);
                this.tryAlternativeFormats();
            }
        );
    }

    loadDormer() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(dracoLoader);
        
        loader.load(
            './models/dormer.glb',
            (gltf) => {
                this.dormerModel = gltf.scene;
                this.scene.add(this.dormerModel);
                this.storeOriginalHeights();
                this.positionDormer();
                this.fitCameraToModel();
                this.hideLoading();
            },
            undefined,
            (error) => {
                console.error('Error loading dormer.glb, trying alternative formats:', error);
                this.tryAlternativeFormatsDormer();
            }
        );
    }

    storeOriginalHeights() {
        if (this.roofModel && this.originalRoofHeight === null) {
            const roofBox = new THREE.Box3().setFromObject(this.roofModel);
            const roofSize = roofBox.getSize(new THREE.Vector3());
            this.originalRoofHeight = roofSize.y;
        }
        
        if (this.dormerModel && this.originalDormerHeight === null) {
            const dormerBox = new THREE.Box3().setFromObject(this.dormerModel);
            const dormerSize = dormerBox.getSize(new THREE.Vector3());
            this.originalDormerHeight = dormerSize.y;
        }
    }

    positionDormer() {
        if (!this.roofModel || !this.dormerModel) return;
        
        const roofBox = new THREE.Box3().setFromObject(this.roofModel);
        const roofSize = roofBox.getSize(new THREE.Vector3());
        const roofWidth = roofSize.z;
        
        this.dormerModel.position.z = roofWidth / 2;
    }

    updateRoofHeight(heightScale) {
        if (!this.roofModel || !this.dormerModel || this.originalRoofHeight === null || this.originalDormerHeight === null) {
            return;
        }
        
        this.roofHeightScale = heightScale;
        
        if (this.roofModel.scale.x === 1 && this.roofModel.scale.z === 1) {
            this.roofModel.scale.set(1, heightScale, 1);
        } else {
            this.roofModel.scale.y = heightScale;
        }
        
        const currentRoofHeight = this.originalRoofHeight * heightScale;
        const dormerScaleY = currentRoofHeight / this.originalDormerHeight;
        
        if (this.dormerModel.scale.x === 1 && this.dormerModel.scale.z === 1) {
            this.dormerModel.scale.set(1, dormerScaleY, 1);
        } else {
            this.dormerModel.scale.y = dormerScaleY;
        }
        
        this.positionDormer();
    }

    setupControls() {
        setTimeout(() => {
            this.initControls();
        }, 100);
    }

    initControls() {
        const roofHeightSlider = document.getElementById('roofHeight');
        const roofHeightValue = document.getElementById('roofHeight-value');
        
        if (roofHeightSlider && roofHeightValue) {
            roofHeightValue.textContent = roofHeightSlider.value;
            
            roofHeightSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.updateRoofHeight(value);
                roofHeightValue.textContent = value.toFixed(2);
            });
        }
    }

    tryAlternativeFormats() {
        const formats = ['.gltf', '.obj', '.fbx'];
        const loader = new GLTFLoader();
        let formatIndex = 0;
        
        const tryNextFormat = () => {
            if (formatIndex >= formats.length) {
                console.warn('Could not load roof in any format. Please export from Blender as GLB/GLTF.');
                this.hideLoading();
                return;
            }
            
            const format = formats[formatIndex];
            const path = `./models/roof${format}`;
            
            loader.load(
                path,
                (gltf) => {
                    this.roofModel = gltf.scene;
                    this.scene.add(this.roofModel);
                    this.storeOriginalHeights();
                    this.positionDormer();
                    this.fitCameraToModel();
                    this.hideLoading();
                },
                undefined,
                () => {
                    formatIndex++;
                    tryNextFormat();
                }
            );
        };
        
        tryNextFormat();
    }

    tryAlternativeFormatsDormer() {
        const formats = ['.gltf', '.obj', '.fbx'];
        const loader = new GLTFLoader();
        let formatIndex = 0;
        
        const tryNextFormat = () => {
            if (formatIndex >= formats.length) {
                console.warn('Could not load dormer in any format. Please export from Blender as GLB/GLTF.');
                this.hideLoading();
                return;
            }
            
            const format = formats[formatIndex];
            const path = `./models/dormer${format}`;
            
            loader.load(
                path,
                (gltf) => {
                    this.dormerModel = gltf.scene;
                    this.scene.add(this.dormerModel);
                    this.storeOriginalHeights();
                    this.positionDormer();
                    this.hideLoading();
                },
                undefined,
                () => {
                    formatIndex++;
                    tryNextFormat();
                }
            );
        };
        
        tryNextFormat();
    }

    fitCameraToModel() {
        const objects = [];
        if (this.roofModel) objects.push(this.roofModel);
        if (this.dormerModel) objects.push(this.dormerModel);
        
        if (objects.length === 0) return;
        
        const box = new THREE.Box3();
        objects.forEach(obj => {
            const objBox = new THREE.Box3().setFromObject(obj);
            box.union(objBox);
        });
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        this.camera.position.set(
            center.x + distance * 0.7,
            center.y + distance * 0.7,
            center.z + distance * 0.7
        );
        this.camera.lookAt(center);
        this.controls.target.copy(center);
        this.controls.update();
    }


    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new RoofViewer();
});

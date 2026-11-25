import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const screen=document.querySelector('#pulsar');
let renderer, scene, camera, controls, star, field, frame, last;
function init(){
 renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#pulsar-scene'),antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight);
 scene=new THREE.Scene(); scene.background=new THREE.Color(0x080b12);
 new THREE.TextureLoader().load('eso0932a.jpg',t=>{t.colorSpace=THREE.SRGBColorSpace;t.mapping=THREE.EquirectangularReflectionMapping;scene.background=t});
 camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,100); camera.position.set(6,4,9);
 controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.minDistance=3; controls.maxDistance=25;
 scene.add(new THREE.AmbientLight(0x789bc8,1.5)); const light=new THREE.PointLight(0xb9eaff,80); light.position.set(3,4,5); scene.add(light);
 star=new THREE.Group(); scene.add(star);
 const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshStandardMaterial({color:0x6cc9ff,emissive:0x126ab0,emissiveIntensity:1.1,roughness:.55})); star.add(sphere);
 // Surface markings make the star's spin visible.
 for(let i=0;i<14;i++){const stripe=new THREE.Mesh(new THREE.TorusGeometry(1.002, .006, 6, 96),new THREE.MeshBasicMaterial({color:0xbcecff,transparent:true,opacity:.35})); stripe.rotation.x=Math.PI/2; stripe.rotation.y=i*Math.PI/14; star.add(stripe)}
 field=new THREE.Group(); field.rotation.z=.35; star.add(field);
 for(let a=0;a<16;a++) for(const extent of [1.8,2.6,3.5,4.5]){
  const pts=[]; const start=Math.asin(Math.sqrt(1/extent));
  for(let j=0;j<=120;j++){const theta=start+(Math.PI-2*start)*j/120; const r=extent*Math.sin(theta)**2; const phi=a*Math.PI*2/16; pts.push(new THREE.Vector3(r*Math.sin(theta)*Math.cos(phi),r*Math.cos(theta),r*Math.sin(theta)*Math.sin(phi)))}
  field.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x65bfff,transparent:true,opacity:.28,depthWrite:false})));
 }
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
}
function animate(now){if(screen.classList.contains('hidden'))return; const dt=last===undefined?0:Math.min((now-last)/1000,.1);last=now;star.rotation.y+=dt*.45;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate)}
document.querySelector('#launch-pulsar').addEventListener('click',()=>{document.querySelector('#home').classList.add('hidden');screen.classList.remove('hidden');if(!renderer)init();last=undefined;frame=requestAnimationFrame(animate)});
document.querySelector('#pulsar-back').addEventListener('click',()=>{cancelAnimationFrame(frame);screen.classList.add('hidden');document.querySelector('#home').classList.remove('hidden')});

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const data=[
 ['The Sun',0,0,1.25,'sun','The star at the center of our solar system.',0],
 ['Mercury',.387,0.241,1.25*2439.7/695700,'mercury','The smallest planet, closest to the Sun.',.3],
 ['Venus',.723,0.615,1.25*6051.8/695700,'venus_atmosphere','A cloud-covered world with a scorching surface.',1.7],
 ['Earth',1,1,1.25*6371/695700,'earth_daymap','Our home, a world of liquid water and life.',2.8],
 ['Mars',1.524,1.881,1.25*3389.5/695700,'mars','A cold desert world known as the red planet.',4.1],
 ['Jupiter',5.203,11.86,1.25*69911/695700,'jupiter','The largest planet, a giant of swirling clouds.',5.3],
 ['Saturn',9.537,29.45,1.25*58232/695700,'saturn','A gas giant surrounded by magnificent rings.',.8],
 ['Uranus',19.191,84.02,1.25*25362/695700,'uranus','An ice giant that rotates on its side.',2.2],
 ['Neptune',30.069,164.8,1.25*24622/695700,'neptune','A distant, deep blue and windswept world.',3.5],
 ['Pluto',39.482,247.94,1.25*1188.3/695700,'pluto','A small dwarf planet in the distant Kuiper Belt.',4.7]
];
const localTextures={Mercury:'8k_mercury.jpg',Venus:'4k_venus_atmosphere.jpg',Earth:'8k_earth_daymap.jpg',Mars:'8k_mars.jpg',Jupiter:'8k_jupiter.jpg',Saturn:'8k_saturn.jpg',Uranus:'2k_uranus.jpg',Neptune:'2k_neptune.jpg',Pluto:'Pluto_Made.webp'};
let renderer,scene,camera,controls,objects=[],orbitLines=[],selected=0,started=false; const scale=12;
const minimumSize=document.querySelector('#minimum-size');
const timeSpeed=document.querySelector('#time-speed');
// Approximate sidereal rotation periods in Earth days; negative values rotate retrograde.
const rotationDays=[25.38,58.646,-243.025,0.99727,1.02596,0.41354,0.44401,-0.71833,0.67125,-6.38723];
const viewPosition=new THREE.Vector3();
function init(){renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#scene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;scene=new THREE.Scene();scene.background=new THREE.Color(0x070b10);camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.00001,3000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.autoRotate=true;controls.minDistance=.00001;controls.maxDistance=1200;
const loader=new THREE.TextureLoader();loader.load('eso0932a.jpg',t=>{const canvas=document.createElement('canvas');canvas.width=t.image.width;canvas.height=t.image.height;const ctx=canvas.getContext('2d');ctx.drawImage(t.image,0,0);ctx.fillStyle='rgba(0, 0, 0, 0.7)';ctx.fillRect(0,0,canvas.width,canvas.height);const background=new THREE.CanvasTexture(canvas);background.colorSpace=THREE.SRGBColorSpace;background.mapping=THREE.EquirectangularReflectionMapping;scene.background=background;t.dispose()});
scene.add(new THREE.AmbientLight(0xffffff,.12));const light=new THREE.PointLight(0xfff4e6,3,0,0);scene.add(light);const colors=[0xffb457,0xa79b8f,0xe5bd84,0x508ac5,0xc66f4f,0xc9ad90,0xd4c29e,0x99d7dc,0x487fd1,0xbab0a2];
data.forEach((d,i)=>{let mat=i===0?new THREE.MeshBasicMaterial({color:colors[i]}):new THREE.MeshStandardMaterial({color:colors[i],roughness:1});loader.load(localTextures[d[0]] ?? `https://www.solarsystemscope.com/textures/download/2k_${d[4]}.jpg`,t=>{t.colorSpace=THREE.SRGBColorSpace;mat.map=t;mat.color.set(0xffffff);mat.needsUpdate=true});const mesh=new THREE.Mesh(new THREE.SphereGeometry(d[3],48,32),mat);scene.add(mesh);objects.push(mesh);if(i){mesh.position.set(Math.cos(d[6])*d[1]*scale,0,Math.sin(d[6])*d[1]*scale);const points=[];for(let j=0;j<=256;j++){let a=j/256*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*d[1]*scale,0,Math.sin(a)*d[1]*scale))}const orbitLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xa63e38,transparent:true,opacity:.65}));orbitLines.push(orbitLine);scene.add(orbitLine);}if(i===6){const ringGeometry=new THREE.RingGeometry(d[3]*.6/.46,d[3]*.95/.46,80);const ringUV=ringGeometry.attributes.uv;const ringPosition=ringGeometry.attributes.position;for(let j=0;j<ringUV.count;j++){const radius=Math.hypot(ringPosition.getX(j),ringPosition.getY(j));ringUV.setXY(j,(radius-d[3]*.6/.46)/(d[3]*(.95-.6)/.46),.5)}const ringMaterial=new THREE.MeshBasicMaterial({color:0xc6b398,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false});loader.load('8k_saturn_ring_alpha.png',t=>{t.colorSpace=THREE.SRGBColorSpace;ringMaterial.map=t;ringMaterial.color.set(0xffffff);ringMaterial.opacity=1;ringMaterial.needsUpdate=true});const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=-Math.PI/2;mesh.add(ring)}});select(0);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});animate()}
let last, days=0,previous=new THREE.Vector3();function animate(now=performance.now()){requestAnimationFrame(animate);const dt=last===undefined?0:(now-last)/1000;last=now;const elapsedDays=dt*Number(timeSpeed.value)/86400;days+=elapsedDays;objects.forEach((m,i)=>{if(i){let d=data[i],a=d[6]+days/(d[2]*365.25)*Math.PI*2;m.position.set(Math.cos(a)*d[1]*scale,0,Math.sin(a)*d[1]*scale)}m.rotation.y+=elapsedDays/rotationDays[i]*Math.PI*2});let p=objects[selected].position;let delta=p.clone().sub(previous);camera.position.add(delta);controls.target.copy(p);previous.copy(p);controls.update(dt);camera.updateMatrixWorld();objects.forEach((m,i)=>{m.scale.setScalar(1);if(!minimumSize.checked||i===0)return;viewPosition.copy(m.position).applyMatrix4(camera.matrixWorldInverse);const depth=-viewPosition.z;if(depth<=0)return;const worldPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/renderer.domElement.clientHeight;m.scale.setScalar(Math.max(1,10*worldPerPixel/(2*data[i][3])))});renderer.render(scene,camera)}
function select(i){selected=i;const d=data[i];document.querySelector('#name').textContent=d[0];document.querySelector('#description').textContent=d[5];document.querySelector('#distance').textContent=d[1]+' AU';document.querySelector('#period').textContent=i?d[2]+' Earth years':'—';document.querySelector('#index').textContent=String(i).padStart(2,'0')+' / 09';if(camera){const p=objects[i].position;const dist=d[3]*(i===6?5.5:4);const direction=i?objects[0].position.clone().sub(p).normalize():new THREE.Vector3(0,0,1);controls.enableDamping=false;controls.update();controls.minDistance=d[3]*1.2;camera.position.copy(p).addScaledVector(direction,dist);controls.target.copy(p);previous.copy(p);controls.update();controls.enableDamping=true}}
document.querySelector('#launch').onclick=()=>{document.querySelector('#home').classList.add('hidden');document.querySelector('#explorer').classList.remove('hidden');if(!started){started=true;try{init()}catch(e){console.error(e);document.querySelector('#error').classList.remove('hidden')}}};document.querySelector('#back').onclick=()=>{document.querySelector('#explorer').classList.add('hidden');document.querySelector('#home').classList.remove('hidden')};window.addEventListener('keydown',e=>{
 if(document.querySelector('#explorer').classList.contains('hidden')||e.ctrlKey||e.metaKey||e.altKey)return;
 if(/^[0-9]$/.test(e.key)){select(Number(e.key));return}
 if(e.key==='['||e.key===']'){
  e.preventDefault();
  timeSpeed.selectedIndex=Math.max(0,Math.min(timeSpeed.options.length-1,timeSpeed.selectedIndex+(e.key===']'?1:-1)));
 }else if(e.key.toLowerCase()==='r'&&!e.repeat){
  controls.autoRotate=!controls.autoRotate;
 }else if(e.key.toLowerCase()==='o'&&!e.repeat){
  orbitLines.forEach(line=>line.visible=!line.visible);
 }else if(e.key.toLowerCase()==='l'&&!e.repeat){
  document.querySelector('.info').classList.toggle('hidden');
 }
});

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
// One AU spans 12 scene units; body radii use the same distance scale.
const scale=12, kilometersPerAU=149597870.7;
const radiusFromKm=radius=>radius/kilometersPerAU*scale;
const data=[
 ['The Sun',0,0,radiusFromKm(695700),'sun','The star at the center of our solar system.',0],
 ['Mercury',.387,0.241,radiusFromKm(2439.7),'mercury','The smallest planet, closest to the Sun.',.3],
 ['Venus',.723,0.615,radiusFromKm(6051.8),'venus_atmosphere','A cloud-covered world with a scorching surface.',1.7],
 ['Earth',1,1,radiusFromKm(6371),'earth_daymap','Our home, a world of liquid water and life.',2.8],
 ['Mars',1.524,1.881,radiusFromKm(3389.5),'mars','A cold desert world known as the red planet.',4.1],
 ['Jupiter',5.203,11.86,radiusFromKm(69911),'jupiter','The largest planet, a giant of swirling clouds.',5.3],
 ['Saturn',9.537,29.45,radiusFromKm(58232),'saturn','A gas giant surrounded by magnificent rings.',.8],
 ['Uranus',19.191,84.02,radiusFromKm(25362),'uranus','An ice giant that rotates on its side.',2.2],
 ['Neptune',30.069,164.8,radiusFromKm(24622),'neptune','A distant, deep blue and windswept world.',3.5],
 ['Pluto',39.482,247.94,radiusFromKm(1188.3),'pluto','A small dwarf planet in the distant Kuiper Belt.',4.7]
];
// Approximate J2000 orbital elements: eccentricity, inclination, ascending node,
// and argument of perihelion (angles in degrees), relative to the ecliptic.
const orbitalElements=[null,
 [0.20563,7.005,48.331,29.125], [0.00677,3.395,76.680,54.884],
 [0.01671,0,0,102.937], [0.09340,1.850,49.558,286.502],
 [0.04849,1.303,100.464,273.867], [0.05551,2.489,113.665,339.392],
 [0.04630,0.773,74.006,96.998], [0.00899,1.770,131.784,273.187],
 [0.24881,17.140,110.299,113.834]
];
// Eccentric anomaly parameterizes an ellipse with the Sun at one focus.
function orbitPosition(index, eccentricAnomaly, target=new THREE.Vector3()){
 const [e,inclination,node,perihelion]=orbitalElements[index];
 const a=data[index][1]*scale;
 const x=a*(Math.cos(eccentricAnomaly)-e), z=a*Math.sqrt(1-e*e)*Math.sin(eccentricAnomaly);
 const w=THREE.MathUtils.degToRad(perihelion), n=THREE.MathUtils.degToRad(node), inc=THREE.MathUtils.degToRad(inclination);
 const u=x*Math.cos(w)-z*Math.sin(w), v=x*Math.sin(w)+z*Math.cos(w);
 return target.set(u*Math.cos(n)-v*Math.cos(inc)*Math.sin(n),v*Math.sin(inc),u*Math.sin(n)+v*Math.cos(inc)*Math.cos(n));
}
function eccentricAnomaly(meanAnomaly,e){
 const mean=THREE.MathUtils.euclideanModulo(meanAnomaly,Math.PI*2);
 let eccentric=mean;
 for(let j=0;j<8;j++) eccentric-=(eccentric-e*Math.sin(eccentric)-mean)/(1-e*Math.cos(eccentric));
 return eccentric;
}
const localTextures={'The Sun':'8k_sun.jpg',Mercury:'8k_mercury.jpg',Venus:'4k_venus_atmosphere.jpg',Earth:'8k_earth_daymap.jpg',Mars:'8k_mars.jpg',Jupiter:'8k_jupiter.jpg',Saturn:'8k_saturn.jpg',Uranus:'2k_uranus.jpg',Neptune:'2k_neptune.jpg',Pluto:'Pluto_Made.webp'};
let renderer,scene,camera,controls,earthClouds,objects=[],orbitLines=[],orbitPaths=[],selected=0,lookAtObject=null,started=false;
const orbitSegments=256;
// Match the rendered line segments, including their Float32 vertex precision.
function positionOnOrbit(index, anomaly, target){
 const segment=THREE.MathUtils.euclideanModulo(anomaly,Math.PI*2)/(Math.PI*2)*orbitSegments;
 const start=Math.floor(segment);
 return target.lerpVectors(orbitPaths[index][start],orbitPaths[index][start+1],segment-start);
}
// JPL mean elements use local Laplace planes for Jupiter and Saturn, and equatorial planes for Uranus, Neptune and Pluto.
// The pole directions are equatorial J2000 coordinates; convert them to scene ecliptic coordinates.
function laplaceBasis(ra,dec){
 const r=THREE.MathUtils.degToRad(ra), d=THREE.MathUtils.degToRad(dec), obliquity=THREE.MathUtils.degToRad(23.439291);
 const x=Math.cos(d)*Math.cos(r), y=Math.cos(d)*Math.sin(r), z=Math.sin(d);
 const pole=new THREE.Vector3(x, z*Math.cos(obliquity)-y*Math.sin(obliquity), y*Math.cos(obliquity)+z*Math.sin(obliquity));
 const ascending=new THREE.Vector3(0,1,0).cross(pole).normalize();
 return {ascending, transverse:new THREE.Vector3().crossVectors(ascending,pole).normalize(), pole};
}
const satellites=[
 {name:'The Moon',parent:3,radius:1737.4,a:384400,e:.0549,inc:5.145,node:0,peri:0,period:27.321661,mean:1,texture:'8k_moon.jpg',description:"Earth's natural satellite."},
 {name:'Io',parent:5,radius:1821.49,a:421800,e:.004,inc:0,node:0,peri:49.1,period:1.762732,mean:330.9*Math.PI/180,ra:268.1,dec:64.5,texture:'Dh_io_texture.webp',description:'A volcanic moon of Jupiter.'},
 {name:'Europa',parent:5,radius:1560.8,a:671100,e:.009,inc:.5,node:184,peri:45,period:3.525463,mean:345.4*Math.PI/180,ra:268.1,dec:64.5,texture:'Dh_europa_texture.webp',description:'An icy moon of Jupiter with an ocean beneath its surface.'},
 {name:'Ganymede',parent:5,radius:2631.2,a:1070400,e:.001,inc:.2,node:58.5,peri:198.3,period:7.155588,mean:324.8*Math.PI/180,ra:268.2,dec:64.6,texture:'Dh_ganymede_texture.webp',description:'Jupiter?s largest moon and the largest moon in the solar system.'},
 {name:'Callisto',parent:5,radius:2410.3,a:1882700,e:.007,inc:.3,node:309.1,peri:43.8,period:16.690440,mean:87.4*Math.PI/180,ra:268.7,dec:64.8,texture:'Callisto-1.webp',description:'A heavily cratered moon of Jupiter.'},
 {name:'Enceladus',parent:6,radius:252.1,a:238400,e:.005,inc:0,node:0,peri:119.5,period:1.370218,mean:57*Math.PI/180,ra:40.6,dec:83.5,texture:'Enceladus.webp',description:'An icy moon of Saturn with an ocean beneath its surface.'},
 {name:'Titan',parent:6,radius:2574.76,a:1221900,e:.029,inc:.3,node:78.6,peri:78.3,period:15.945448,mean:11.7*Math.PI/180,ra:36.4,dec:84,texture:'Titan_map_augh.webp',description:'Saturn\'s largest moon, with a thick atmosphere and methane lakes.'},
 {name:'Titania',parent:7,radius:788.9,a:436298,e:.002,inc:.1,node:29.5,peri:184,period:8.705869,mean:68.1*Math.PI/180,ra:257.311,dec:-15.175,texture:'Titaniamap.webp',description:'The largest moon of Uranus, with a surface marked by craters and canyons.'},
 {name:'Charon',parent:9,radius:606,a:19600,e:0,inc:0,node:0,peri:0,period:6.387222,mean:304.1*Math.PI/180,ra:132.993,dec:-6.163,texture:'Charon.webp',description:'The largest moon of Pluto.'},
 {name:'Triton',parent:8,radius:1352.6,a:354800,e:0,inc:157.3,node:177.7,peri:0,period:5.8792,mean:63*Math.PI/180,ra:299.334,dec:42.95,texture:'triton_texture_map_14k__by_askaniy_dcln18g-pre.jpg',description:'Neptune\'s largest moon, orbiting in a retrograde direction.'},
 {name:'Phobos',parent:4,radius:11.2667,a:9376,e:.0151,inc:1.1,node:0,peri:0,period:.31891,mean:1.2,ra:317.681,dec:52.887,shape:[13.0,9.1,11.4],color:0x8b8178,texture:'RS3_Phobos.webp',description:'The larger, inner moon of Mars, with an irregular rocky shape.'},
 {name:'Deimos',parent:4,radius:6.2,a:23463,e:.0002,inc:1.8,node:0,peri:0,period:1.26244,mean:3.4,ra:317.681,dec:52.887,shape:[7.8,5.1,6.0],color:0x9b8e82,texture:'Deimos.png?v=2',description:'The smaller, outer moon of Mars, with an irregular rocky shape.'}
];
for(const satellite of satellites){
 satellite.radiusScene=radiusFromKm(satellite.radius);
 if(satellite.ra!==undefined) satellite.basis=laplaceBasis(satellite.ra,satellite.dec);
}
function satelliteOrbitPosition(s,anomaly,target=new THREE.Vector3()){
 const a=radiusFromKm(s.a), x=a*(Math.cos(anomaly)-s.e), z=a*Math.sqrt(1-s.e*s.e)*Math.sin(anomaly);
 const w=THREE.MathUtils.degToRad(s.peri), n=THREE.MathUtils.degToRad(s.node), inc=THREE.MathUtils.degToRad(s.inc);
 const u=x*Math.cos(w)-z*Math.sin(w), v=x*Math.sin(w)+z*Math.cos(w);
 const px=u*Math.cos(n)-v*Math.cos(inc)*Math.sin(n), pz=u*Math.sin(n)+v*Math.cos(inc)*Math.cos(n), py=v*Math.sin(inc);
 if(!s.basis)return target.set(px,py,pz);
 return target.copy(s.basis.ascending).multiplyScalar(px).addScaledVector(s.basis.transverse,pz).addScaledVector(s.basis.pole,py);
}
// Deform positions while preserving the sphere UVs for equirectangular surface maps.
function irregularMoonGeometry(s){
 const geometry=new THREE.SphereGeometry(1,64,48), positions=geometry.attributes.position;
 const coincidentVertices=new Map();
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
  // Keep UV seam vertices separate, but remember where they share a surface point.
  const key=[x,y,z].map(value=>Math.round(value*100000)).join(',');
  if(!coincidentVertices.has(key))coincidentVertices.set(key,[]);
  coincidentVertices.get(key).push(i);
  const lump=1+.075*Math.sin(3*x+2*y+1.3)*Math.cos(4*z-y)+.045*Math.sin(6*y-3*z+x)+.025*Math.cos(9*x+5*z)*Math.sin(7*y+2*z);
  positions.setXYZ(i,x*radiusFromKm(s.shape[0])*lump,y*radiusFromKm(s.shape[1])*lump,z*radiusFromKm(s.shape[2])*lump);
 }
 geometry.computeVertexNormals();
 const normals=geometry.attributes.normal;
 for(const indices of coincidentVertices.values()){
  if(indices.length<2)continue;
  const normal=new THREE.Vector3();
  for(const i of indices)normal.add(new THREE.Vector3().fromBufferAttribute(normals,i));
  normal.normalize();
  for(const i of indices)normals.setXYZ(i,normal.x,normal.y,normal.z);
 }
 normals.needsUpdate=true;
 return geometry;
}
function updateSatellites(){
 for(const s of satellites){
  const mean=s.mean+days/s.period*Math.PI*2;
  s.mesh.position.copy(satelliteOrbitPosition(s,eccentricAnomaly(mean,s.e))).add(objects[s.parent].position);
  s.mesh.rotation.y=-mean;
  s.line.position.copy(objects[s.parent].position);
 }
}
const sunAnimationTime={value:0};
let minimumSize=true;
const orbitLineOpacity=.65, orbitLineFadeTime=.35;
let orbitLinesShown=true;
const timeSpeeds=[0,0.1,0.5,1,10,100,1000,10000,100000,1000000];
let timeSpeedIndex=3;
// Approximate sidereal rotation periods in Earth days; negative values rotate retrograde.
const rotationDays=[25.38,58.646,-243.025,0.99727,1.02596,0.41354,0.44401,-0.71833,0.67125,-6.38723];
const viewPosition=new THREE.Vector3();
const orbitOffset=new THREE.Vector3(), orbitAxis=new THREE.Vector3(0,1,0);
const orbitRadiansPerSecond=2*Math.PI/30, orbitEaseTime=.45;
let autoOrbit=true, interacting=false, orbitSpeed=orbitRadiansPerSecond;
let pausedState=null;
let zoomTarget, pinchDistance;const touchPoints=new Map(), zoomEaseTime=.18;
function changeZoom(factor){const distance=camera.position.distanceTo(controls.target);zoomTarget=THREE.MathUtils.clamp((zoomTarget??distance)*factor,controls.minDistance,controls.maxDistance)}
function setupZoom(){const canvas=renderer.domElement;controls.enableZoom=false;canvas.addEventListener('wheel',e=>{if(!controls.enabled)return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);changeZoom(Math.exp(THREE.MathUtils.clamp(delta,-500,500)*.001))},{passive:false});canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});pinchDistance=undefined});canvas.addEventListener('pointermove',e=>{if(!touchPoints.has(e.pointerId))return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size!==2){pinchDistance=undefined;return}const [a,b]=touchPoints.values();const distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance&&distance)changeZoom(pinchDistance/distance);pinchDistance=distance});const endTouch=e=>{touchPoints.delete(e.pointerId);pinchDistance=undefined};canvas.addEventListener('pointerup',endTouch);canvas.addEventListener('pointercancel',endTouch)}
// Blend the night map by the surface's angle to the Sun at the scene origin.
function addEarthNightMap(material, loader){
  loader.load('8k_earth_nightmap.jpg', texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    material.onBeforeCompile=shader=>{
      shader.uniforms.earthNightMap={value:texture};
      shader.vertexShader=shader.vertexShader.replace('#include <common>', `#include <common>
        varying vec2 earthUv;
        varying vec3 earthWorldPosition;
        varying vec3 earthWorldNormal;`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        earthUv=uv;
        earthWorldPosition=(modelMatrix * vec4(position, 1.0)).xyz;
        earthWorldNormal=normalize(mat3(modelMatrix) * normal);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D earthNightMap;
        varying vec2 earthUv;
        varying vec3 earthWorldPosition;
        varying vec3 earthWorldNormal;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
        float daylight=smoothstep(-0.12, 0.12, dot(normalize(earthWorldNormal), normalize(-earthWorldPosition)));
        outgoingLight=mix(texture2D(earthNightMap, earthUv).rgb, outgoingLight, daylight);
        #include <opaque_fragment>`);
    };
    material.needsUpdate=true;
  });
}
// Animate the local solar image with a small, seamless object-space distortion.
function animateSunMaterial(material){
  material.onBeforeCompile=shader=>{
    shader.uniforms.sunTime=sunAnimationTime;
    shader.vertexShader=shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 sunPosition;`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      sunPosition=normalize(position);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float sunTime;
      varying vec3 sunPosition;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec3 p=normalize(sunPosition);
        float wave1=sin(p.x*18.0+p.y*12.0+sunTime*0.22)*sin(p.z*15.0-p.y*9.0-sunTime*0.16);
        float wave2=sin(p.z*21.0+p.x*11.0+sunTime*0.15)*sin(p.y*17.0-p.x*8.0+sunTime*0.19);
        vec2 warpedUv=vMapUv+vec2(wave1, wave2)*0.003;
        diffuseColor *= texture2D(map, warpedUv);
      #endif`);
  };
}
// Project Saturn's silhouette away from the Sun onto its ring plane.
function addSaturnRingShadow(ring, planet, planetRadius){
  const sunDirection={value:new THREE.Vector3()};
  const ringOrientation=new THREE.Quaternion();
  ring.material.onBeforeCompile=shader=>{
    shader.uniforms.ringSunDirection=sunDirection;
    shader.uniforms.saturnRadius={value:planetRadius};
    shader.vertexShader=shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 ringLocalPosition;`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      ringLocalPosition=position;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 ringSunDirection;
      uniform float saturnRadius;
      varying vec3 ringLocalPosition;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      float towardSun=dot(ringLocalPosition, ringSunDirection);
      vec3 closestToAxis=ringLocalPosition-towardSun*ringSunDirection;
      if(towardSun < 0.0 && dot(closestToAxis, closestToAxis) < saturnRadius*saturnRadius) discard;`);
  };
  ring.onBeforeRender=()=>{
    ring.getWorldQuaternion(ringOrientation);
    sunDirection.value.copy(planet.position).negate().normalize().applyQuaternion(ringOrientation.invert());
  };
}
function createSunGlow(radius){
  // A camera-facing halo keeps the glow radial, with no visible spherical shell.
  const material=new THREE.ShaderMaterial({
    uniforms:{sunTime:sunAnimationTime},
    vertexShader:`varying vec2 haloUv;
      void main(){
        haloUv=uv*2.0-1.0;
        vec4 center=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);
        vec2 size=vec2(length(modelViewMatrix[0].xyz),length(modelViewMatrix[1].xyz));
        center.xy+=position.xy*size;
        gl_Position=projectionMatrix*center;
      }`,
    fragmentShader:`uniform float sunTime; varying vec2 haloUv;
      void main(){
        float distanceFromCenter=length(haloUv);
        float edge=1.0/2.0;
        float altitude=max(distanceFromCenter-edge,0.0);
        float falloff=exp(-altitude*8.0);
        float outerFade=1.0-smoothstep(0.78,1.0,distanceFromCenter);
        float pulse=0.95+0.05*sin(sunTime*0.7);
        float intensity=falloff*0.72*outerFade*pulse;
        gl_FragColor=vec4(1.0,0.38,0.06,intensity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
  });
  const halo=new THREE.Sprite(material);
  halo.scale.set(radius*4,radius*4,1);
  return halo;
}
function init(){renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#scene'),antialias:true,logarithmicDepthBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;scene=new THREE.Scene();scene.background=new THREE.Color(0x070b10);camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.00001,3000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.addEventListener('start',()=>{interacting=true;orbitSpeed=0});controls.addEventListener('end',()=>{interacting=false});controls.minDistance=.00001;controls.maxDistance=1200;setupZoom();
const loader=new THREE.TextureLoader();loader.load('eso0932a.jpg',t=>{const canvas=document.createElement('canvas');canvas.width=t.image.width;canvas.height=t.image.height;const ctx=canvas.getContext('2d');ctx.drawImage(t.image,0,0);ctx.fillStyle='rgba(0, 0, 0, 0.7)';ctx.fillRect(0,0,canvas.width,canvas.height);const background=new THREE.CanvasTexture(canvas);background.colorSpace=THREE.SRGBColorSpace;background.mapping=THREE.EquirectangularReflectionMapping;scene.background=background;t.dispose()});
scene.add(new THREE.AmbientLight(0xffffff,.12));const light=new THREE.PointLight(0xfff4e6,3,0,0);scene.add(light);const colors=[0xffb457,0xa79b8f,0xe5bd84,0x508ac5,0xc66f4f,0xc9ad90,0xd4c29e,0x99d7dc,0x487fd1,0xbab0a2];
data.forEach((d,i)=>{let mat=i===0?new THREE.MeshBasicMaterial({color:colors[i]}):new THREE.MeshStandardMaterial({color:colors[i],roughness:1});if(i===0)animateSunMaterial(mat);loader.load(localTextures[d[0]] ?? `https://www.solarsystemscope.com/textures/download/2k_${d[4]}.jpg`,t=>{t.colorSpace=THREE.SRGBColorSpace;mat.map=t;mat.color.set(0xffffff);mat.needsUpdate=true});const mesh=new THREE.Mesh(new THREE.SphereGeometry(d[3],48,32),mat);scene.add(mesh);objects.push(mesh);if(i===0)mesh.add(createSunGlow(d[3]));if(i){const points=[];for(let j=0;j<=orbitSegments;j++){const p=orbitPosition(i,j/orbitSegments*Math.PI*2);points.push(new THREE.Vector3(Math.fround(p.x),Math.fround(p.y),Math.fround(p.z)))}orbitPaths[i]=points;positionOnOrbit(i,eccentricAnomaly(d[6],orbitalElements[i][0]),mesh.position);const orbitGeometry=new LineGeometry().setPositions(points.flatMap(p=>[p.x,p.y,p.z]));const orbitLine=new Line2(orbitGeometry,new LineMaterial({color:0xa63e38,linewidth:2,transparent:true,opacity:orbitLineOpacity,depthWrite:false}));orbitLines.push(orbitLine);scene.add(orbitLine);}if(i===3){addEarthNightMap(mat,loader);const cloudMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:true,depthWrite:false,blending:THREE.CustomBlending,blendEquation:THREE.MaxEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor});earthClouds=new THREE.Mesh(new THREE.SphereGeometry(d[3]*1.01,96,64),cloudMaterial);earthClouds.visible=false;mesh.add(earthClouds);loader.load('8k_earth_clouds.jpg',t=>{t.colorSpace=THREE.SRGBColorSpace;cloudMaterial.map=t;cloudMaterial.needsUpdate=true;earthClouds.visible=true})}if(i===6){const ringInnerRadius=radiusFromKm(66900),ringOuterRadius=radiusFromKm(140220);const ringGeometry=new THREE.RingGeometry(ringInnerRadius,ringOuterRadius,80);const ringUV=ringGeometry.attributes.uv;const ringPosition=ringGeometry.attributes.position;for(let j=0;j<ringUV.count;j++){const radius=Math.hypot(ringPosition.getX(j),ringPosition.getY(j));ringUV.setXY(j,(radius-ringInnerRadius)/(ringOuterRadius-ringInnerRadius),.5)}const ringMaterial=new THREE.MeshBasicMaterial({color:0xc6b398,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false});loader.load('8k_saturn_ring_alpha.png',t=>{t.colorSpace=THREE.SRGBColorSpace;ringMaterial.map=t;ringMaterial.color.set(0xffffff);ringMaterial.opacity=1;ringMaterial.needsUpdate=true});const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=-Math.PI/2;mesh.add(ring);addSaturnRingShadow(ring,mesh,d[3])}});
for(const s of satellites){
 const material=new THREE.MeshStandardMaterial({color:s.color??0xffffff,roughness:1});
 if(s.texture)loader.load(s.texture,t=>{t.colorSpace=THREE.SRGBColorSpace;material.map=t;material.color.set(0xffffff);material.needsUpdate=true});
 s.mesh=new THREE.Mesh(s.shape?irregularMoonGeometry(s):new THREE.SphereGeometry(s.radiusScene,48,32),material);scene.add(s.mesh);
 const points=[];for(let j=0;j<=orbitSegments;j++){const p=satelliteOrbitPosition(s,j/orbitSegments*Math.PI*2);points.push(p.x,p.y,p.z)}
 s.line=new Line2(new LineGeometry().setPositions(points),new LineMaterial({color:0xa63e38,linewidth:2,transparent:true,opacity:orbitLineOpacity,depthWrite:false}));
 orbitLines.push(s.line);scene.add(s.line);
}
updateSatellites();select(0);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});animate()}
let last, days=0,previous=new THREE.Vector3();function animate(now=performance.now()){requestAnimationFrame(animate);const dt=last===undefined?0:(now-last)/1000;last=now;sunAnimationTime.value+=dt*Math.min(timeSpeeds[timeSpeedIndex],5);orbitLines.forEach(line=>{const target=orbitLinesShown?orbitLineOpacity:0;line.material.opacity=THREE.MathUtils.clamp(line.material.opacity+Math.sign(target-line.material.opacity)*orbitLineOpacity*dt/orbitLineFadeTime,Math.min(line.material.opacity,target),Math.max(line.material.opacity,target));line.visible=line.material.opacity>0});const elapsedDays=dt*timeSpeeds[timeSpeedIndex]/86400;days+=elapsedDays;objects.forEach((m,i)=>{if(i){let d=data[i],mean=d[6]+days/(d[2]*365.25)*Math.PI*2;positionOnOrbit(i,eccentricAnomaly(mean,orbitalElements[i][0]),m.position)}m.rotation.y+=elapsedDays/rotationDays[i]*Math.PI*2});if(earthClouds)earthClouds.rotation.y+=elapsedDays/5*Math.PI*2;updateSatellites();let p=selected>=10?satellites[selected-10].mesh.position:objects[selected].position;let delta=p.clone().sub(previous);camera.position.add(delta);controls.target.copy(p);previous.copy(p);if(!interacting){const targetSpeed=autoOrbit?orbitRadiansPerSecond:0;const decay=Math.exp(-dt/orbitEaseTime);const angle=targetSpeed*dt+(orbitSpeed-targetSpeed)*orbitEaseTime*(1-decay);orbitSpeed=targetSpeed+(orbitSpeed-targetSpeed)*decay;orbitOffset.copy(camera.position).sub(controls.target).applyAxisAngle(orbitAxis,-angle);camera.position.copy(controls.target).add(orbitOffset)}controls.update();if(zoomTarget!==undefined){orbitOffset.copy(camera.position).sub(controls.target);const distance=orbitOffset.length();const nextDistance=Math.exp(THREE.MathUtils.lerp(Math.log(distance),Math.log(zoomTarget),1-Math.exp(-dt/zoomEaseTime)));camera.position.copy(controls.target).addScaledVector(orbitOffset,nextDistance/distance)}if(lookAtObject!==null)camera.lookAt(objects[lookAtObject].position);camera.updateMatrixWorld();objects.forEach((m,i)=>{m.scale.setScalar(1);if(!minimumSize)return;viewPosition.copy(m.position).applyMatrix4(camera.matrixWorldInverse);const depth=-viewPosition.z;if(depth<=0)return;const worldPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/renderer.domElement.clientHeight;m.scale.setScalar(Math.max(1,(i===0?20:10)*worldPerPixel/(2*data[i][3])))});for(const s of satellites){s.mesh.scale.setScalar(1);if(minimumSize){viewPosition.copy(s.mesh.position).applyMatrix4(camera.matrixWorldInverse);const depth=-viewPosition.z;if(depth>0){const worldPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/renderer.domElement.clientHeight;s.mesh.scale.setScalar(Math.max(1,10*worldPerPixel/(2*s.radiusScene)))}}}renderer.render(scene,camera)}
function select(i){
 selected=i;lookAtObject=null;const s=i>=10?satellites[i-10]:null;
 const d=s?[s.name,s.a,s.period,s.radiusScene,'',s.description]:data[i];
 document.querySelector('#name').textContent=d[0];document.querySelector('#description').textContent=d[5];
 document.querySelector('#distance-label').textContent=s?`MEAN DISTANCE FROM ${data[s.parent][0].toUpperCase()}`:'DISTANCE FROM SUN';
 document.querySelector('#distance').textContent=s?`${s.a.toLocaleString()} km`:d[1]+' AU';
 document.querySelector('#period').textContent=s?`${s.period.toFixed(2)} Earth days`:i?d[2]+' Earth years':'?';
 document.querySelector('#index').textContent=s?'MOON':String(i).padStart(2,'0')+' / 09';
 if(camera){const p=s?s.mesh.position:objects[i].position;const dist=d[3]*(i===6?5.5:4);const direction=i?objects[0].position.clone().sub(p).normalize():new THREE.Vector3(0,0,1);if(i===6){const inclination=THREE.MathUtils.degToRad(5);direction.multiplyScalar(Math.cos(inclination));direction.y=Math.sin(inclination)}controls.enableDamping=false;controls.update();controls.minDistance=d[3]*1.2;camera.near=Math.min(.00001,d[3]/100);camera.updateProjectionMatrix();camera.position.copy(p).addScaledVector(direction,dist);controls.target.copy(p);previous.copy(p);zoomTarget=dist;controls.update();controls.enableDamping=true}
}
const notification=document.querySelector('#notification');
let notificationTimer;
function notify(message){notification.textContent=message;notification.classList.add('visible');clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>notification.classList.remove('visible'),1000)}
document.querySelector('#launch').onclick=()=>{document.querySelector('#home').classList.add('hidden');document.querySelector('#explorer').classList.remove('hidden');if(!started){started=true;try{init()}catch(e){console.error(e);document.querySelector('#error').classList.remove('hidden')}}};document.querySelector('#back').onclick=()=>{document.querySelector('#explorer').classList.add('hidden');document.querySelector('#home').classList.remove('hidden')};window.addEventListener('keydown',e=>{
 if(document.querySelector('#explorer').classList.contains('hidden')||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.code==='Space'){
  e.preventDefault();
  if(e.repeat)return;
  if(pausedState){
   timeSpeedIndex=pausedState.timeSpeedIndex;
   autoOrbit=pausedState.autoOrbit;
   pausedState=null;
   notify('Time and camera rotation restored');
  }else{
   pausedState={timeSpeedIndex,autoOrbit};
   timeSpeedIndex=0;
   autoOrbit=false;
   orbitSpeed=0;
   notify('Time and camera rotation paused');
  }
  return;
 }
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
  e.preventDefault();
  if(!camera||!controls.enabled)return;
  if(e.key==='ArrowUp'||e.key==='ArrowDown')changeZoom(e.key==='ArrowUp'?.9:1/.9);
  else{
   orbitOffset.copy(camera.position).sub(controls.target).applyAxisAngle(orbitAxis,e.key==='ArrowLeft'?-.08:.08);
   camera.position.copy(controls.target).add(orbitOffset);
  }
  return;
 }
 if(e.shiftKey&&/^Digit[0-9]$/.test(e.code)){
  e.preventDefault();
  if(e.repeat)return;
  const target=Number(e.code.slice(-1));
  lookAtObject=target===selected||target===lookAtObject?null:target;
  notify(lookAtObject===null?'Looking at current destination':`Looking at ${data[target][0]}`);
  return;
 }
 if(/^[0-9]$/.test(e.key)){select(Number(e.key));return}
 if(e.key.toLowerCase()==='m'&&!e.repeat){
  const planet=selected>=10?satellites[selected-10].parent:selected;
  const moonsByPlanet={3:[10],4:[20,21],5:[11,12,13,14],6:[15,16],7:[17],8:[19],9:[18]};
  const moons=moonsByPlanet[planet]||[];
  if(moons.length)select(moons[(moons.indexOf(selected)+1)%moons.length]);
  else notify(`No moons available for ${data[planet][0]}`);
  return;
 }
 if(e.key==='['||e.key===']'){
  e.preventDefault();
  timeSpeedIndex=Math.max(0,Math.min(timeSpeeds.length-1,timeSpeedIndex+(e.key===']'?1:-1)));
  notify(timeSpeeds[timeSpeedIndex]===0?'Time paused':`Time speed: ${timeSpeeds[timeSpeedIndex].toLocaleString()}?`);
 }else if(e.key.toLowerCase()==='s'&&!e.repeat){
  minimumSize=!minimumSize;
  notify(`Minimum planet size ${minimumSize?'enabled':'disabled'}`);
 }else if(e.key.toLowerCase()==='r'&&!e.repeat){
  autoOrbit=!autoOrbit;
  notify(`Camera rotation ${autoOrbit?'resumed':'stopped'}`);
 }else if(e.key.toLowerCase()==='o'&&!e.repeat){
  orbitLinesShown=!orbitLinesShown;
  notify(`Orbit lines ${orbitLinesShown?'shown':'hidden'}`);
 }else if(e.key.toLowerCase()==='l'&&!e.repeat){
  const hidden=document.querySelector('.info').classList.toggle('hidden');
  notify(`Information panel ${hidden?'hidden':'shown'}`);
 }
});

/* Reference-based furniture. Models share the office's existing materials;
 * the photographs guide silhouette and joinery, never surface decals. */

/** A closed, gently rounded laminated sheet with real thickness. */
function furnitureSheet(surface, thickness, material, up, nu = 36, nv = 28) {
  const pos = [], uv = [], idx = [], hint = new THREE.Vector3(...up);
  const point = (u,v) => new THREE.Vector3(...surface(u,v));
  let flip = false;
  for (let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) {
    const u=i/nu*2-1, v=j/nv*2-1, p=point(u,v), e=.001;
    const du=point(Math.min(1,u+e),v).sub(point(Math.max(-1,u-e),v));
    const dv=point(u,Math.min(1,v+e)).sub(point(u,Math.max(-1,v-e)));
    const normal=du.cross(dv).normalize();
    if(i===nu/2 && j===nv/2) flip=normal.dot(hint)<0;
    if(normal.dot(hint)<0) normal.negate();
    pos.push(...p.toArray(),...p.clone().addScaledVector(normal,-thickness).toArray());
    uv.push((u+1)*.65,(v+1)*.65,(u+1)*.65,(v+1)*.65);
  }
  const tri=(a,b,c)=>idx.push(a,flip?c:b,flip?b:c);
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++) {
    const a=2*(j*(nu+1)+i), b=a+2, c=a+2*(nu+1), d=c+2;
    tri(a,b,c);tri(b,d,c);tri(a+1,c+1,b+1);tri(b+1,c+1,d+1);
  }
  const rim=(a,b)=>{tri(a,a+1,b);tri(b,a+1,b+1);};
  for(let i=0;i<nu;i++){rim(2*i,2*(i+1));rim(2*(nv*(nu+1)+i+1),2*(nv*(nu+1)+i));}
  for(let j=0;j<nv;j++){rim(2*((j+1)*(nu+1)),2*(j*(nu+1)));rim(2*(j*(nu+1)+nu),2*((j+1)*(nu+1)+nu));}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.userData.noCollide=true;return mesh;
}

/** Match fabric grain in metres on top, side and back surfaces. */
function upholsteryUV(geometry, scale=[1,1,1]) {
  const g=geometry.index?geometry.toNonIndexed():geometry, p=g.getAttribute('position'),uv=[];
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){
    a.fromBufferAttribute(p,i).multiply(new THREE.Vector3(...scale));b.fromBufferAttribute(p,i+1).multiply(new THREE.Vector3(...scale));c.fromBufferAttribute(p,i+2).multiply(new THREE.Vector3(...scale));
    const n=b.clone().sub(a).cross(c.clone().sub(a));const k=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)];const axis=k.indexOf(Math.max(...k)),pair=axis===0?[2,1]:axis===1?[0,2]:[0,1];
    for(const v of [a,b,c]){const q=v.toArray();uv.push(q[pair[0]]*2.5,q[pair[1]]*2.5);}
  }
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}

/** The reference's armless pebble silhouette on a recessed swivel plinth. */
function referenceBoucleChair() {
  const g=new THREE.Group();g.name='boucle-pebble-chair';g.userData.keep=true;
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.32,.34,.075,48),MAT.graphite);plinth.position.y=.05;g.add(plinth);
  const seat=new THREE.Mesh(upholsteryUV(softBlock(.89,.33,.84,{r:.15,n:2.6,crown:.045,dish:.012,segs:56,rings:7})),BOUCLE);seat.position.set(0,.075,.06);seat.userData.noCollide=true;g.add(seat);
  const back=new THREE.Mesh(upholsteryUV(new THREE.SphereGeometry(1,52,36),[.43,.39,.205]),BOUCLE);back.scale.set(.43,.39,.205);back.rotation.x=-.24;back.position.set(0,.49,-.24);back.userData.noCollide=true;g.add(back);
  // A shallow upholstered junction, rather than the old encircling arms.
  const lumbar=new THREE.Mesh(upholsteryUV(new THREE.SphereGeometry(1,40,24),[.37,.16,.13]),BOUCLE);lumbar.scale.set(.37,.16,.13);lumbar.position.set(0,.32,-.18);lumbar.userData.noCollide=true;g.add(lumbar);
  addProxy(g,.78,.29,.69,0,.22,.055);addProxy(g,.75,.46,.17,0,.52,-.28,-.24);
  g.add(placed(contactShadow(1.15,1.15,.3),0,.006,0));return shadowAll(g,true,true);
}

/** Smooth kidney plan, with a continuous low back rolling into both arms. */
function referenceCurvedSofa(C,seatsOut) {
  const g=new THREE.Group();g.name='boucle-kidney-sofa';g.userData.keep=true;
  const outline=[[-1.13,-1.05],[-1.27,-1.22],[-1.64,-1.16],[-1.82,-.72],[-1.86,0],[-1.80,.77],[-1.61,1.18],[-1.22,1.20],[-1.00,.91],[-1.07,.51],[-1.20,.02],[-1.14,-.55]];
  const curve=new THREE.CatmullRomCurve3(outline.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
  const shape=new THREE.Shape();curve.getPoints(100).forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.23,bevelEnabled:true,bevelSize:.065,bevelThickness:.065,bevelSegments:6,curveSegments:48});geo.rotateX(-HALF_PI);geo.translate(0,.13,0);
  const seat=new THREE.Mesh(upholsteryUV(geo),BOUCLE);seat.userData.noCollide=true;g.add(seat);
  const path=new THREE.CatmullRomCurve3([[-1.08,.41,-1.04],[-1.42,.43,-1.13],[-1.68,.44,-.75],[-1.76,.44,0],[-1.68,.44,.76],[-1.40,.42,1.13],[-1.05,.39,1.03]].map(p=>new THREE.Vector3(...p)));
  const rows=path.getPoints(64).map((p,i)=>{const t=Math.min(i,64-i)/64,cap=Math.sqrt(1-Math.pow(1-Math.min(1,t/.075),2));return {p:p.toArray(),a:.32*Math.max(.02,cap),b:.135*Math.max(.02,cap)};});
  const back=new THREE.Mesh(upholsteryUV(superLoft(rows,{U:[0,1,0],n:2.6,segs:32})),BOUCLE);back.userData.noCollide=true;g.add(back);
  // A round bouclé cushion and a soft rectangular cushion echo the photograph.
  const round=new THREE.Mesh(upholsteryUV(new THREE.SphereGeometry(.20,32,24),[.48,1,1]),BOUCLE);round.scale.set(.48,1,1);round.position.set(-1.58,.59,.61);g.add(round);
  const pillow=new THREE.Mesh(softBlock(.11,.30,.32,{r:.045,n:3,segs:28}),MAT.oatmeal);pillow.position.set(-1.40,.43,.44);pillow.rotation.x=-.12;g.add(pillow);
  // Match the existing agent seats and use narrow curved proxies so the aisle remains open.
  for(const a of [-.48,0,.48]) {const r=1.4,x=C.x-Math.cos(a)*r,z=C.z+Math.sin(a)*r*.94;seatsOut.push({x,z,face:Math.atan2(Math.cos(a),-Math.sin(a)),lift:SOFA_SEAT-DIM.seatTop-.02,taken:false,area:'lounge'});addProxy(g,.52,.36,.56,-Math.cos(a)*r,.23,Math.sin(a)*r,0,a,0);}
  const plinth=new THREE.Mesh(roundedBoxGeometry(.55,.065,1.90,.025,3),MAT.graphite);plinth.position.set(-1.48,.065,0);g.add(plinth);
  g.add(placed(contactShadow(1.5,2.85,.34),-1.4,.006,0));g.scale.z=.94;g.position.set(C.x,0,C.z);return shadowAll(g,true,true);
}

/** Thick, softly rounded organic top on two cylindrical white-oak bases, from Igor's reference. */
function referenceOakTable() {
  const g = new THREE.Group();
  g.name = 'organic-white-oak-coffee-table';
  g.userData.keep = true;
  const shape = new THREE.Shape();
  shape.moveTo(-0.74, 0.04);
  shape.bezierCurveTo(-0.79, 0.31, -0.47, 0.44, -0.17, 0.36);
  shape.bezierCurveTo(0.04, 0.30, 0.25, 0.33, 0.47, 0.25);
  shape.bezierCurveTo(0.68, 0.18, 0.80, 0.01, 0.74, -0.17);
  shape.bezierCurveTo(0.67, -0.39, 0.40, -0.41, 0.13, -0.31);
  shape.bezierCurveTo(-0.07, -0.23, -0.22, -0.26, -0.43, -0.30);
  shape.bezierCurveTo(-0.69, -0.34, -0.80, -0.16, -0.74, 0.04);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.064, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 5, curveSegments: 64 });
  geo.rotateX(-HALF_PI);
  const pos = geo.attributes.position, normals = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(normals.getY(i)) > 0.5) uv.setXY(i, pos.getX(i) * 0.62 + 0.5, pos.getZ(i) * 0.75 + 0.5);
    else uv.setXY(i, pos.getX(i) * 0.62 + pos.getZ(i) * 0.45, pos.getY(i) * 2.0);
  }
  uv.needsUpdate = true;
  const top = new THREE.Mesh(geo, MAT.oak);
  top.position.y = 0.288;
  top.userData.collide = true;
  g.add(top);
  for (const [x, z, radius] of [[-0.40, 0.035, 0.205], [0.40, -0.015, 0.225]]) {
    const profile = [new THREE.Vector2(0, 0.012), new THREE.Vector2(radius - 0.008, 0.012), new THREE.Vector2(radius, 0.020), new THREE.Vector2(radius, 0.276), new THREE.Vector2(radius - 0.008, 0.286), new THREE.Vector2(0, 0.286)];
    const baseGeo = new THREE.LatheGeometry(profile, 64);
    const baseUV = baseGeo.attributes.uv;
    for (let i = 0; i < baseUV.count; i++) { const u = baseUV.getX(i), v = baseUV.getY(i); baseUV.setXY(i, v, u * 1.8); }
    baseUV.needsUpdate = true;
    const base = new THREE.Mesh(baseGeo, MAT.oak);
    base.position.set(x, 0, z);
    base.userData.collide = true;
    g.add(base);
  }
  g.add(placed(contactShadow(1.68, 1.05, 0.23), 0, 0.006, 0));
  g.userData.top = 0.36;
  return shadowAll(g, true, true);
}

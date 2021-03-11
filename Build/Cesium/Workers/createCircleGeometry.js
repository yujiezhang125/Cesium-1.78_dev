define(["./Cartesian2-49b1de22","./Check-6c0211bc","./when-54c2dc71","./EllipseGeometry-bf6804f0","./VertexFormat-7572c785","./Math-44e92d6b","./GeometryOffsetAttribute-d889f085","./Transforms-e9dbfb40","./RuntimeError-2109023a","./ComponentDatatype-6d99a1ee","./WebGLConstants-76bb35d1","./EllipseGeometryLibrary-60ebd5f1","./GeometryAttribute-669569db","./GeometryAttributes-4fcfcf40","./GeometryInstance-6d66d24e","./GeometryPipeline-39e647e8","./AttributeCompression-8ecc041c","./EncodedCartesian3-7ff81df8","./IndexDatatype-46306178","./IntersectionTests-6ead8677","./Plane-8f7e53d1"],function(r,e,o,n,s,t,i,l,a,d,m,c,u,p,y,_,h,G,x,f,g){"use strict";function E(e){var t=(e=o.defaultValue(e,o.defaultValue.EMPTY_OBJECT)).radius,e={center:e.center,semiMajorAxis:t,semiMinorAxis:t,ellipsoid:e.ellipsoid,height:e.height,extrudedHeight:e.extrudedHeight,granularity:e.granularity,vertexFormat:e.vertexFormat,stRotation:e.stRotation,shadowVolume:e.shadowVolume};this._ellipseGeometry=new n.EllipseGeometry(e),this._workerName="createCircleGeometry"}E.packedLength=n.EllipseGeometry.packedLength,E.pack=function(e,t,i){return n.EllipseGeometry.pack(e._ellipseGeometry,t,i)};var v=new n.EllipseGeometry({center:new r.Cartesian3,semiMajorAxis:1,semiMinorAxis:1}),b={center:new r.Cartesian3,radius:void 0,ellipsoid:r.Ellipsoid.clone(r.Ellipsoid.UNIT_SPHERE),height:void 0,extrudedHeight:void 0,granularity:void 0,vertexFormat:new s.VertexFormat,stRotation:void 0,semiMajorAxis:void 0,semiMinorAxis:void 0,shadowVolume:void 0};return E.unpack=function(e,t,i){t=n.EllipseGeometry.unpack(e,t,v);return b.center=r.Cartesian3.clone(t._center,b.center),b.ellipsoid=r.Ellipsoid.clone(t._ellipsoid,b.ellipsoid),b.height=t._height,b.extrudedHeight=t._extrudedHeight,b.granularity=t._granularity,b.vertexFormat=s.VertexFormat.clone(t._vertexFormat,b.vertexFormat),b.stRotation=t._stRotation,b.shadowVolume=t._shadowVolume,o.defined(i)?(b.semiMajorAxis=t._semiMajorAxis,b.semiMinorAxis=t._semiMinorAxis,i._ellipseGeometry=new n.EllipseGeometry(b),i):(b.radius=t._semiMajorAxis,new E(b))},E.createGeometry=function(e){return n.EllipseGeometry.createGeometry(e._ellipseGeometry)},E.createShadowVolume=function(e,t,i){var r=e._ellipseGeometry._granularity,o=e._ellipseGeometry._ellipsoid,t=t(r,o),i=i(r,o);return new E({center:e._ellipseGeometry._center,radius:e._ellipseGeometry._semiMajorAxis,ellipsoid:o,stRotation:e._ellipseGeometry._stRotation,granularity:r,extrudedHeight:t,height:i,vertexFormat:s.VertexFormat.POSITION_ONLY,shadowVolume:!0})},Object.defineProperties(E.prototype,{rectangle:{get:function(){return this._ellipseGeometry.rectangle}},textureCoordinateRotationPoints:{get:function(){return this._ellipseGeometry.textureCoordinateRotationPoints}}}),function(e,t){return(e=o.defined(t)?E.unpack(e,t):e)._ellipseGeometry._center=r.Cartesian3.clone(e._ellipseGeometry._center),e._ellipseGeometry._ellipsoid=r.Ellipsoid.clone(e._ellipseGeometry._ellipsoid),E.createGeometry(e)}});

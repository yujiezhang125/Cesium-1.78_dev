var OglParser = /** @class */ (function () {
    function OglParser() {
    }
    OglParser.parseGeometry = function (buffer, geometryId, extend) {
        var reader = new ArrayBufferReader(buffer);
        var geometry = new THREE.BufferGeometry();
        reader.getUint32();
        geometry.setAttribute('position', new THREE.BufferAttribute(reader.getFloat32Array(reader.getUint32()), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(reader.getFloat32Array(reader.getUint32()), 3));
        var uvCount = reader.getUint32();
        uvCount && geometry.setAttribute('uv', new THREE.BufferAttribute(reader.getFloat32Array(uvCount), 2));
        var useInt16 = reader.getUint32() == 0, indexArray, indexLength = reader.getUint32();
        if (useInt16) {
            indexArray = reader.getUint16Array(indexLength);
        }
        else {
            indexArray = reader.getUint32Array(indexLength);
        }
        geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
        //补齐
        if (indexLength % 2 && useInt16) {
            reader.offset += 2;
        }
        if (extend) //set the extend from param
            geometry.boundingBox = new THREE.Box3(extend.minimum, extend.maximum);
        var groupCount = reader.getUint32(); //at least one sub mesh
        // console.log("groupCount:" + groupCount);
        for (var i = 0; i < groupCount; i++) {
            var startIndex = reader.getUint32();
            var indexCount = reader.getUint32();
            var materialIndex = reader.getUint32();
            geometry.addGroup(startIndex, indexCount, materialIndex);
        }
        return geometry;
    };
    return OglParser;
}());
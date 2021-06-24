// import * as THREE from 'three';

/**
 * GridTree is a space split oct-tree which origin center is fixed to (0,0,0).
 * Each object added to GridNode must contains area(max projection area), center, box properties
 * After added, the object will add gridNode property to link the object and gridNode
 *
 * @author Yao Yuan
 * @date 2020-03-16
 * @export
 * @class GridTree
 */
class GridTree {

    constructor ( minExtentSize, maxExtentSize, looseRatio, cullRatio ) {
        this.minExtentSize = minExtentSize || 4;
        this.maxExtentSize = maxExtentSize || 1048576;
        this.looseRatio = looseRatio || 1.15;
        this.cullRatio = cullRatio || 0.02;
        this.center = new THREE.Vector3( 0, 0, 0 );
        this.extents = new THREE.Vector3( maxExtentSize, maxExtentSize, maxExtentSize );
        this.rootNode = new GridNode( this, null, '', this.center, this.extents ); // the root node
    }

    getTotalNodeCount () {
        return this.rootNode.getDescendantNodeCount() + 1;
    }

    add ( obj ) { //obj must contains area(max projection area), center, box properties
        return this.rootNode.add( obj );
    }

    shrink () {
        this.rootNode.shrink();
    }

    initMeshes () {
        this.rootNode.initMeshes();
    }
}


/**
 *
 *
 * @author Yao Yuan
 * @date 2020-03-16
 * @class GridNode
 */
class GridNode {

    constructor ( gridTree, parent, idx, center, extents ) {
        this.gridTree = gridTree;
        this.no = "";
        this.parent = parent;
        if ( this.parent )
            this.no = this.parent.no + idx;
        this.center = center;
        this.extents = extents;
        this.looseExtents = extents.clone().multiplyScalar( this.gridTree.looseRatio );
        this.childNodes = null;
        this.area = 4 * Math.sqrt( extents.x * extents.x * extents.y * extents.y + extents.x * extents.x * extents.z * extents.z + extents.z * extents.z * extents.y * extents.y );
        this.cullArea = this.area * this.gridTree.cullRatio * this.gridTree.cullRatio; //裁剪面积变小了
        this.objects = [];
        this.meshes = [];
        // this.nextMerge = 0;
        this.box = new THREE.Box3( new THREE.Vector3().copy( this.center ).sub( this.extents ), new THREE.Vector3().copy( this.center ).add( this.extents ) );
        this.looseBox = new THREE.Box3( new THREE.Vector3().copy( this.center ).sub( this.looseExtents ), new THREE.Vector3().copy( this.center ).add( this.looseExtents ) );
        this.looseSphere = this.looseBox.getBoundingSphere( new THREE.Sphere() );
        this.totalTriangles = 0;
        this.totalVertices = 0;
        this.tileBox = new THREE.Box3(); // tileBox is smaller than gridBox, it's the union of each model's aabb bounding box. attention: each tile has many merged meshes.
        this.tileSphere = new THREE.Sphere();
    }

    deepFirstTraversal ( callback ) {
        callback( this );
        if ( this.childNodes ) {
            for ( let i = 0; i < 8; i++ ) {
                let childNode = this.childNodes[ i ];
                if ( childNode ) {
                    childNode.deepFirstTraversal( callback );
                }
            }
        }
    }

    isEmptyNode () {
        return this.objects.length === 0 && this.childNodes === null;
    }

    isLeaf () {
        return this.childNodes === null;
    }

    canSplit () {
        let minExtentSize = this.gridTree.minExtentSize; // 只要比 4*4*4的立方体大，就可以分裂
        return ( this.extents.x > minExtentSize && this.extents.y > minExtentSize && this.extents.z > minExtentSize );
    }

    split () {
        if ( !this.canSplit() ) {
            console.log( "can't split" );
            return;
        }

        this.childNodes = [];
        let childExtents = this.extents.clone().multiplyScalar( 0.5 );

        this.childNodes.push( new GridNode( this.gridTree, this, 0, new THREE.Vector3( this.center.x - childExtents.x, this.center.y - childExtents.y, this.center.z - childExtents.z ), childExtents ) );
        this.childNodes.push( new GridNode( this.gridTree, this, 1, new THREE.Vector3( this.center.x - childExtents.x, this.center.y - childExtents.y, this.center.z + childExtents.z ), childExtents ) );
        this.childNodes.push( new GridNode( this.gridTree, this, 2, new THREE.Vector3( this.center.x - childExtents.x, this.center.y + childExtents.y, this.center.z - childExtents.z ), childExtents ) );
        this.childNodes.push( new GridNode( this.gridTree, this, 3, new THREE.Vector3( this.center.x - childExtents.x, this.center.y + childExtents.y, this.center.z + childExtents.z ), childExtents ) );
        this.childNodes.push( new GridNode( this.gridTree, this, 4, new THREE.Vector3( this.center.x + childExtents.x, this.center.y - childExtents.y, this.center.z - childExtents.z ), childExtents ) );
        this.childNodes.push( new GridNode( this.gridTree, this, 5, new THREE.Vector3( this.center.x + childExtents.x, this.center.y - childExtents.y, this.center.z + childExtents.z ), childExtents ) );
        this.childNodes.push( new GridNode( this.gridTree, this, 6, new THREE.Vector3( this.center.x + childExtents.x, this.center.y + childExtents.y, this.center.z - childExtents.z ), childExtents ) );
        this.childNodes.push( new GridNode( this.gridTree, this, 7, new THREE.Vector3( this.center.x + childExtents.x, this.center.y + childExtents.y, this.center.z + childExtents.z ), childExtents ) );
    }

    shrink () {
        if ( this.childNodes ) {
            let hasChild = false;
            for ( let i = 0; i < 8; i++ ) {
                let childNode = this.childNodes[ i ];

                childNode && childNode.shrink();

                if ( childNode && !childNode.isEmptyNode() ) {
                    hasChild = true;
                }
            }
            if ( !hasChild ) this.childNodes = null;
        }
    }

    add ( obj ) {
        this.tileBox.union( obj.box );
        this.tileBox.getBoundingSphere( this.tileSphere );

        //return the node contains obj
        if ( obj.area >= this.cullArea ) { //grid的cullArea减小，导致obj更容易集中在上层
            this.objects.push( obj );
            obj.gridNode = this;
            return this;
        }

        //reach leaf and can split, split the leaf node and add 8 child to it.
        if ( this.isLeaf() && this.canSplit() ) {
            this.split();
        }

        if ( this.childNodes ) //has child node
        {
            for ( let i = 0; i < 8; i++ ) {
                let childNode = this.childNodes[ i ];

                if ( childNode.box.containsPoint( obj.center ) && childNode.looseBox.containsBox( obj.box ) ) {
                    return childNode.add( obj ); //call add recursively
                }
            }
        }
        //if not return before, the object can't hold by any child(reach the minimal node),
        //so hold it by this.
        this.objects.push( obj );
        obj.gridNode = this; //attach gridNode to model
        return this;
    }

    getDescendantNodeCount () {
        let ret = 0;
        if ( this.childNodes )
            for ( let i = 0; i < 8; i++ ) {
                let childNode = this.childNodes[ i ];
                if ( childNode ) ret = ret + childNode.getDescendantNodeCount() + 1;
            }
        return ret;
    }

    getDescendantNodes () {
        let ret = [];
        if ( this.childNodes )
            for ( let i = 0; i < 8; i++ ) {
                let childNode = this.childNodes[ i ];
                if ( childNode ) {
                    ret.push( childNode );
                    ret = ret.concat( childNode.getDescendantNodes() );
                }
            }
        return ret;
    }

}
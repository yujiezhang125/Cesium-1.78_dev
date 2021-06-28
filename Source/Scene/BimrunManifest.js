import Cartesian2 from "../Core/Cartesian2";
import Cartesian3 from "../Core/Cartesian3";

function BimrunManifest(){
    console.log('manifest')
}
Object.defineProperties(BimrunManifest.prototype, {
    name: {
        get: function (){
            return this._name;
        },
        set: function (value){
            this._name = valus;
        },
    },
});

BimrunManifest.prototype.printName = function(){
    console.log(this._name);
};
export default BimrunManifest;
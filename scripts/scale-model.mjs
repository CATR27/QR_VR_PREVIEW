// Uso: node scripts/scale-model.mjs <entrada.glb> <salida.glb> <alturaMetros>
// Hornea una escala uniforme en la geometría para que el modelo mida <alturaMetros> de alto
// (glTF: 1 unidad = 1 metro) con la base en y = 0. Necesario para que el tamaño en AR sea real.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds, transformMesh, center } from "@gltf-transform/functions";

const [input, output, heightArg] = process.argv.slice(2);
const target = Number(heightArg);
if (!input || !output || !(target > 0)) {
  console.error("Uso: node scripts/scale-model.mjs <entrada.glb> <salida.glb> <alturaMetros>");
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

const before = getBounds(scene);
const height = before.max[1] - before.min[1];
const s = target / height;
const matrix = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, matrix);

await doc.transform(center({ pivot: "below" }));
const after = getBounds(scene);
await io.write(output, doc);

const fmt = (b) => b.max.map((v, i) => (v - b.min[i]).toFixed(3)).join(" × ");
console.log(`factor ${s.toFixed(5)} | antes ${fmt(before)} | después ${fmt(after)} (m)`);

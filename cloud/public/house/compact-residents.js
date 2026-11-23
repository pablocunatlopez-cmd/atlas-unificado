import * as THREE from './vendor/three.module.js';
import { residentAppearance } from './resident-appearance.js';

const base = new URL('./assets/models/lod/', import.meta.url);
const variants = ['female-standing', 'female-seated', 'male-standing', 'male-seated'];

async function loadModel(variant) {
  const { GLTFLoader } = await import('./vendor/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(new URL(variant + '.glb', base).href);
  return gltf.scene;
}

/** Anatomical meshes shared across the cast. Close actors can still use the
 * authored high detail rig without changing their identity or world position. */
export function createCompactResidents(parent, { load = loadModel } = {}) {
  const root = new THREE.Group();
  root.name = 'atlas-compact-residents';
  parent.add(root);
  const templates = new Map();
  const actors = new Map();
  const pending = new Set();
  const failed = new Set();
  const assets = new Set();
  let disposed = false;

  function releaseTemplate(scene) {
    const resources = new Set();
    scene.traverse(object => {
      if (!object.isMesh) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      }
    });
    for (const resource of resources) resource.dispose();
  }

  function preload() {
    for (const variant of variants) {
      if (disposed || pending.has(variant) || failed.has(variant) || templates.has(variant)) continue;
      pending.add(variant);
      Promise.resolve().then(() => load(variant)).then(scene => {
        if (disposed) return releaseTemplate(scene);
        templates.set(variant, scene);
      }).catch(() => failed.add(variant)).finally(() => pending.delete(variant));
    }
  }

  function actorFor(resident, appearance, variant) {
    const key = resident.id + ':' + variant;
    let actor = actors.get(key);
    if (actor) return actor;
    actor = templates.get(variant).clone(true);
    actor.name = 'compact-' + resident.id;
    actor.userData = { residentId: resident.id, source: 'MakeHuman CC0', functionIds: appearance.functionIds };
    const colors = new Map();
    actor.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = false;
      const color = material => {
        if (colors.has(material)) return colors.get(material);
        const clone = material.clone();
        const part = object.userData.anatomyPart || material.name;
        if (part === 'tunic') clone.color.set(appearance.uniform);
        if (part === 'hair') clone.color.multiply(new THREE.Color(appearance.hair));
        colors.set(material, clone);
        assets.add(clone);
        return clone;
      };
      object.material = Array.isArray(object.material) ? object.material.map(color) : color(object.material);
    });
    root.add(actor);
    actors.set(key, actor);
    return actor;
  }

  return {
    preload,
    beginFrame() { for (const actor of actors.values()) actor.visible = false; },
    update(resident, { position = resident.position, yaw = resident.yaw, moving = false, motion } = {}) {
      if (disposed || resident.archetype !== 'human') return false;
      const appearance = residentAppearance(resident.id);
      if (!appearance) return false;
      const variant = appearance.template + (resident.seated && !moving ? '-seated' : '-standing');
      if (!templates.has(variant)) return false;
      const actor = actorFor(resident, appearance, variant);
      actor.position.fromArray(position);
      if (moving) actor.position.y += Math.min(.022, Math.max(0, motion?.bob || 0));
      actor.rotation.y = Math.PI - yaw;
      actor.scale.setScalar(appearance.height / 1.84);
      actor.visible = true;
      return true;
    },
    status() { return { loaded: templates.size, loading: pending.size > 0, failed: failed.size > 0 }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const asset of assets) asset.dispose();
      for (const scene of templates.values()) releaseTemplate(scene);
      assets.clear();
      templates.clear();
      actors.clear();
      root.clear();
    }
  };
}

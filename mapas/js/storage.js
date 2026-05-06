(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  const STORAGE_PREFIX = 'territorio_editor_project_';
  const STORAGE_INDEX = 'territorio_editor_project_index';
  const VERSION_PREFIX = 'territorio_editor_versions_';

  function currentProjectId(project) {
    return utils.safeName((project && project.projectName) || T.state.projectName || 'mapa') || utils.uid('mapa');
  }

  function getIndex() {
    try { return JSON.parse(localStorage.getItem(STORAGE_INDEX) || '[]'); }
    catch (error) { return []; }
  }

  function setIndex(index) {
    localStorage.setItem(STORAGE_INDEX, JSON.stringify(index));
  }

  function saveProject(project) {
    const id = currentProjectId(project);
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(project));
    const index = getIndex().filter(function (item) { return item.id !== id; });
    index.unshift({ id: id, name: project.projectName, savedAt: project.savedAt || new Date().toISOString() });
    setIndex(index);
    return id;
  }

  function openProject(id) {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  function deleteProject(id) {
    localStorage.removeItem(STORAGE_PREFIX + id);
    localStorage.removeItem(VERSION_PREFIX + id);
    setIndex(getIndex().filter(function (item) { return item.id !== id; }));
  }

  function downloadProject(project) {
    const name = utils.safeName(project.projectName || 'mapa-territorio') + '.json';
    utils.downloadText(name, JSON.stringify(project, null, 2), 'application/json');
  }

  function getVersions(projectId) {
    try { return JSON.parse(localStorage.getItem(VERSION_PREFIX + projectId) || '[]'); }
    catch (error) { return []; }
  }

  function saveVersion(project, note) {
    const projectId = currentProjectId(project);
    const versions = getVersions(projectId);
    versions.unshift({
      id: utils.uid('version'),
      savedAt: new Date().toISOString(),
      note: note || 'manual',
      project: project
    });
    while (versions.length > 25) versions.pop();
    localStorage.setItem(VERSION_PREFIX + projectId, JSON.stringify(versions));
    return versions[0].id;
  }

  function restoreVersion(projectId, versionId) {
    const version = getVersions(projectId).find(function (item) { return item.id === versionId; });
    return version ? version.project : null;
  }

  function autoSave() {
    if (!T.state.settings.autoSave) return;
    try {
      const project = T.store.currentProject();
      saveProject(project);
      const id = currentProjectId(project);
      const versions = getVersions(id);
      const now = Date.now();
      const last = versions[0] ? new Date(versions[0].savedAt).getTime() : 0;
      if (!last || now - last > 5 * 60 * 1000) saveVersion(project, 'autosave');
      if (T.ui) {
        T.ui.refreshLocalProjects();
        T.ui.refreshVersions();
      }
    } catch (error) {
      console.warn('Autosalvamento falhou:', error);
    }
  }

  T.storage = { currentProjectId, getIndex, saveProject, openProject, deleteProject, downloadProject, getVersions, saveVersion, restoreVersion, autoSave };
})();

(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  const STORAGE_PREFIX = 'territorio_editor_project_';
  const STORAGE_INDEX = 'territorio_editor_project_index';

  function getIndex() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_INDEX) || '[]');
    } catch (error) {
      return [];
    }
  }

  function setIndex(index) {
    localStorage.setItem(STORAGE_INDEX, JSON.stringify(index));
  }

  function saveProject(project) {
    const id = utils.safeName(project.projectName || 'mapa') || utils.uid();

    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(project));

    const index = getIndex().filter(function (item) {
      return item.id !== id;
    });

    index.unshift({
      id,
      name: project.projectName,
      savedAt: project.savedAt || new Date().toISOString()
    });

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
    setIndex(getIndex().filter(function (item) {
      return item.id !== id;
    }));
  }

  function downloadProject(project) {
    const name = utils.safeName(project.projectName || 'mapa-territorio') + '.json';
    utils.downloadText(name, JSON.stringify(project, null, 2), 'application/json');
  }

  function autoSave() {
    if (!T.state.settings.autoSave) return;

    try {
      saveProject(T.store.currentProject());
      if (T.ui) T.ui.refreshLocalProjects();
    } catch (error) {
      console.warn('Autosalvamento falhou:', error);
    }
  }

  T.storage = {
    getIndex,
    saveProject,
    openProject,
    deleteProject,
    downloadProject,
    autoSave
  };
})();

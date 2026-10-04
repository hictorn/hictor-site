(() => {
  const params = new URLSearchParams(window.location.search);
  const option = params.get('mock');
  if (['1', '2', '3'].includes(option)) {
    document.documentElement.dataset.fontMock = option;
  }
  if (params.get('preview') === '1') {
    document.documentElement.dataset.preview = 'true';
  }
})();

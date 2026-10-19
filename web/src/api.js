async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（HTTP ${res.status}）`);
  return data;
}

export const api = {
  parse: (body) => request('/api/parse', { method: 'POST', body: JSON.stringify(body) }),
  listRecipes: (params = {}) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.tags && params.tags.length) sp.set('tag', params.tags.join(','));
    const qs = sp.toString();
    return request(`/api/recipes${qs ? `?${qs}` : ''}`);
  },
  getRecipe: (id) => request(`/api/recipes/${id}`),
  createRecipe: (body) => request('/api/recipes', { method: 'POST', body: JSON.stringify(body) }),
  updateRecipe: (id, patch) => request(`/api/recipes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteRecipe: (id) => request(`/api/recipes/${id}`, { method: 'DELETE' }),
  listTags: () => request('/api/tags'),
  listAssets: (category) => request(`/api/assets${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  setCover: (id, body) => request(`/api/recipes/${id}/cover`, { method: 'POST', body: JSON.stringify(body) }),
};

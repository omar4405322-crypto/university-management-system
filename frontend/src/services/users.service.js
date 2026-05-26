import api from './api';

const getProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data;
};

const updateProfile = async (data) => {
  const response = await api.put('/users/profile', data);
  return response.data;
};

const updatePassword = async (data) => {
  const response = await api.put('/users/profile/password', data);
  return response.data;
};

const getUsers = async (params) => {
  const response = await api.get('/users', { params });
  return response.data;
};

const createAdmin = async (data) => {
  const response = await api.post('/users/admins', data);
  return response.data;
};

const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

const usersService = {
  getProfile,
  updateProfile,
  updatePassword,
  getUsers,
  createAdmin,
  deleteUser,
};

export default usersService;

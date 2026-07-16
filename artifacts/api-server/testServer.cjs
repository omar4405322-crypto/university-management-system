const express = require('express');
const { getCourseRoster } = require('./dist/controllers/courses.controller.js');
const app = express();
app.get('/roster/:id', (req, res, next) => {
    // Mock user for getScopeWhere if needed, though roster doesn't use it.
    getCourseRoster(req, res, next).catch(next);
});
app.listen(5001, () => {
  console.log('Test server running');
});

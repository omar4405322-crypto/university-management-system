import express from 'express';
import { getCourseRoster } from './src/controllers/courses.controller';

const app = express();
app.get('/roster/:id', (req, res, next) => {
    getCourseRoster(req, res, next);
});
app.listen(5001, () => {
  console.log('Test server running');
});

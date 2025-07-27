const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homecontroller');

router.get("/user",homeController.gethome);
module.exports = router;

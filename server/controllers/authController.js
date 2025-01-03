
const Citizen = require("../models/citizenModel");
const Location = require("../models/locationModel");

const { matchedData,validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const validateCitizenName = require("../util/loginUtility");
const jwt = require('jsonwebtoken')

const loginController = async(req,res) => {
    let result = validationResult(req);
    if (!result.isEmpty()) return res.status(400).json({"message":"fill in the input with correct info"})
    
    const data = matchedData(req)
    const {citizenName,passCode,longitude,latitude,accuracy} = data;

    if (!validateCitizenName(citizenName)) {
        return res.status(401).json({ message: "Invalid citizen name format" });
      }
      
    if (!citizenName || !passCode || !longitude || !latitude) return res.status(400).json({"message":"fill in the input with correct info"})
    
    try {
        // check if the citizen name contains @ if true is email so user can use email to sign up
        // check if to see if user exist
        const found = await Citizen.findOne({citizenName : citizenName}).exec();
        if (!found) return res.status(401).json({"message":"user not found this ID isnot correct"})
        
        const matched = await bcrypt.compare(passCode,found.hashedPwd);

        if (matched){ 
            const roles = Object.values(found.role);
            // jwt
            const accessToken = jwt.sign(
                { 
                    "userInfo":{
                        "citizenName": found.citizenName, 
                        "citizenID" : found._id,
                        "roles": roles
                    },
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '16m' }
            );
            const refreshToken = jwt.sign(
                { "citizenName": found.citizenName },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: '1d' }
            );


            // save new location when user login
            const newLocation = new Location({
                location: {
                    type: "Point",
                    coordinates: [longitude, latitude]
                },
                accuracy: accuracy 
            });
            await newLocation.save(); 

            // Link the new location to the citizen
            found.location = newLocation._id; 
            // save refresh token with the current user.
            found.refreshToken = refreshToken;
            const result = await found.save();
            console.log(result);
            
            res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge: 24 * 60 * 60 * 1000 });

            // Send authorization roles and access token to client or user
            res.json({ roles, accessToken }); 

        }else {
            return res.status(401).json({"error": "password is not correct" });
        }
        
    } catch (error) {
        res.status(500).json({"mgs":error.message})
    }

}

module.exports = loginController;


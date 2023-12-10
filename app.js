const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");

const app = express();
app.use(express.json());

dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const dbRunner = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Database connected and running on 3000");
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

dbRunner();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(jwtToken, "token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login user

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch) {
      const payload = {
        username: username,
      };
      const jwtToken = jsonwebtoken.sign(payload, "token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get states

app.get("/states/", authToken, async (request, response) => {
  const stateQuery = `SELECT * FROM state`;
  const stateArray = await db.all(stateQuery);
  response.send(
    stateArray.map((state) => convertDbObjectToResponseObject(state))
  );
});

//get state by id

app.get("/states/:stateId/", authToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(stateQuery);
  response.send(convertDbObjectToResponseObject(state));
});

//post district

app.post("/districts/", authToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `INSERT INTO district (district_name,state_id, cases, cured, active, deaths) VALUES ('${districtName}',${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const addDistrict = await db.run(districtQuery);
  response.send("District Successfully Added");
});

//get district

app.get("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const districtQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  const district = await db.get(districtQuery);
  response.send(convertDbObjectToResponseObject(district));
});

//delete district

app.delete("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const deleteQuery = `DELETE FROM district WHERE district_Id = ${districtId};`;
  const deleteDistrict = db.run(deleteQuery);
  response.send("District Removed");
});

//put district

app.put("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateQuery = `UPDATE district SET district_name = '${districtName}' ,state_id = ${stateId} ,cases = ${cases} ,cured = ${cured} ,active = ${active} ,deaths = ${deaths} WHERE district_id = ${districtId};`;
  const updateDistrict = await db.run(updateQuery);
  response.send("District Details Updated");
});

//get stat for state

app.get("/states/:stateId/stats/", authToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatQuery = `SELECT SUM(A.cases) AS totalCases,SUM(A.cured) AS totalCured,SUM(A.active) AS totalActive,SUM(A.deaths) AS totalDeaths
    FROM district AS A
    WHERE A.state_id = ${stateId};`;
  const stat = await db.get(getStatQuery);
  response.send(stat);
});

module.exports = app;

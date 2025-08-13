import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    console.log(process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log({ decoded });
    let user = await getUser(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (user.credit < 1) {
      return res.status(403).json({ message: "Insufficient credit" });
    }
    req.user = user;

    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const getUser = async (id) => {
  try {
    const res = await fetch(`https://fashion.imtiyaz.io/api/users/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.API_KEY}`,
      },
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.log(error);
  }
};

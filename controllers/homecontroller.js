const path=require("path");
const gethome=(req,res)=>{
    res.sendFile(path.join(__dirname,"../public/index.html"));
}
module.exports={
    gethome
}

/* server.js-ə express.json middleware-dən sonra, catch-all route-dan əvvəl əlavə et.
   Render Environment: GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
   Mövcud GROQ_API_KEY server secret kimi qalmalıdır. */
app.post("/api/vision", async (req,res)=>{
 try{
  const key=process.env.GROQ_API_KEY || (typeof GROQ_API_KEY!=="undefined"?GROQ_API_KEY:null);
  if(!key)return res.status(503).json({error:"GROQ_API_KEY konfiqurasiya edilməyib."});
  const image=req.body?.image;
  const prompt=typeof req.body?.prompt==="string"?req.body.prompt.slice(0,2500):"Describe this image.";
  if(typeof image!=="string"||!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(image))return res.status(400).json({error:"Etibarlı şəkil göndərilməyib."});
  if(image.length>11000000)return res.status(413).json({error:"Şəkil çox böyükdür."});
  const model=process.env.GROQ_VISION_MODEL||"meta-llama/llama-4-scout-17b-16e-instruct";
  const upstream=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:.25,max_tokens:900,messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:image}}]}]}),signal:AbortSignal.timeout(60000)});
  const data=await upstream.json().catch(()=>({}));if(!upstream.ok)return res.status(upstream.status).json({error:data?.error?.message||"Vision API xətası."});
  const answer=data?.choices?.[0]?.message?.content?.trim();if(!answer)return res.status(502).json({error:"Vision modeli boş cavab qaytardı."});
  res.json({answer,model});
 }catch(e){console.error("vision error",e);res.status(500).json({error:"Şəkil analizi zamanı server xətası."});}
});

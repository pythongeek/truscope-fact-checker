import { Router } from "express";
import aiEditorRouter from "./ai-editor";

const router = Router();

router.use("/ai-editor", aiEditorRouter);

export default router;

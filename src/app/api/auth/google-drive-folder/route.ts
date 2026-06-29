import { NextRequest, NextResponse } from "next/server";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderId, folderName } = body;

    if (!folderId || !folderName) {
      return NextResponse.json({ error: "folderId and folderName are required" }, { status: 400 });
    }

    const adminSupabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "No authenticated user" }, { status: 401 });
    }

    const adminServiceSupabase = createAdminServiceClient();
    const { data: usuario, error: usuarioError } = await adminServiceSupabase
      .from("usuarios")
      .select("metadata")
      .eq("auth_user_id", user.id)
      .single();

    if (usuarioError || !usuario) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    const currentMetadata = usuario.metadata || {};
    const currentDriveConfig = currentMetadata.drive_config || {};
    const updatedMetadata = {
      ...currentMetadata,
      drive_config: {
        ...currentDriveConfig,
        drive_folder: {
          id: folderId,
          name: folderName,
        },
      },
    };

    const { error: updateError } = await adminServiceSupabase
      .from("usuarios")
      .update({ metadata: updatedMetadata })
      .eq("auth_user_id", user.id);

    if (updateError) {
      console.error("Error saving Drive folder selection:", updateError);
      return NextResponse.json({ error: updateError.message || "Failed to save folder selection" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { drive_folder: updatedMetadata.drive_config.drive_folder } }, { status: 200 });
  } catch (error: any) {
    console.error("Error in save Drive folder route:", error);
    return NextResponse.json({ error: error.message || "Failed to save Drive folder" }, { status: 500 });
  }
}

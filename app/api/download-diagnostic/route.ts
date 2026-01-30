import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    // Security: allow only diagnostic CSV files with safe filenames
    // - no path separators
    // - must match our generated naming convention
    if (
      fileName.includes('/') ||
      fileName.includes('\\') ||
      !/^diagnostic-[\w-]+\.csv$/i.test(fileName)
    ) {
      return NextResponse.json(
        { error: 'Invalid diagnostic file name' },
        { status: 400 }
      );
    }

    // Security: Only allow files from public directory
    const filePath = path.join(process.cwd(), 'public', fileName);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Return as downloadable CSV
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error('Error downloading diagnostic file:', error);
    return NextResponse.json(
      { error: 'Failed to download file', details: error.message },
      { status: 500 }
    );
  }
}

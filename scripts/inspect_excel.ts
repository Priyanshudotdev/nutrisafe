import * as xlsx from 'xlsx';

function inspectExcel() {
  const workbook = xlsx.readFile('assets/temp/Anuvaad_INDB_2024.11.xlsx');
  const sheetName = workbook.SheetNames[0];
  console.log(`Sheet name: ${sheetName}`);
  
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Print headers
  if (data.length > 0) {
    console.log('Headers:');
    console.log(data[0]);
    
    // Print first data row as example
    if (data.length > 1) {
      console.log('\nFirst row of data:');
      console.log(data[1]);
    }
  } else {
    console.log('Sheet is empty.');
  }
}

inspectExcel();

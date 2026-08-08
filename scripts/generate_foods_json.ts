import * as xlsx from 'xlsx';
import * as fs from 'fs';

function generateJson() {
  console.log("Reading Excel file...");
  const workbook = xlsx.readFile('assets/temp/Anuvaad_INDB_2024.11.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rawData: any[] = xlsx.utils.sheet_to_json(worksheet);
  console.log(`Processing ${rawData.length} foods...`);
  
  const formattedFoods = rawData.map(row => {
    let name = row.food_name || "Unknown Food";
    let aliases: string[] = [];
    
    const match = name.match(/\((.*?)\)/);
    if (match) {
      aliases.push(match[1].trim());
      name = name.replace(/\(.*?\)/, '').trim();
    }
    
    const primarySource = row.primarysource?.toLowerCase() || "";
    let source = "INDB";
    if (primarySource.includes("ifct")) {
      source = "IFCT_2017";
    }

    return {
      foodCode: row.food_code || "",
      name: name,
      aliases: aliases.length > 0 ? aliases : undefined,
      category: "Indian Food", 
      foodType: row.food_code?.startsWith("ASC") ? "recipe" : "raw",
      source: source,
      
      nutrition: {
        energyKcal: Number(row.energy_kcal) || 0,
        protein: Number(row.protein_g) || 0,
        carbohydrates: Number(row.carb_g) || 0,
        freeSugar: Number(row.freesugar_g) || 0,
        fat: Number(row.fat_g) || 0,
        saturatedFat: (Number(row.sfa_mg) || 0) / 1000, 
        fibre: Number(row.fibre_g) || 0,
        cholesterol: Number(row.cholesterol_mg) || 0,
        sodium: Number(row.sodium_mg) || 0,
        potassium: Number(row.potassium_mg) || 0,
        phosphorus: Number(row.phosphorus_mg) || 0,
        calcium: Number(row.calcium_mg) || 0,
        magnesium: Number(row.magnesium_mg) || 0,
        iron: Number(row.iron_mg) || 0,
        zinc: Number(row.zinc_mg) || 0,
        vitaminC: Number(row.vitc_mg) || 0,
        folate: Number(row.folate_ug) || 0,
      },
      
      serving: {
        quantity: 100,
        unit: "g"
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  });

  fs.writeFileSync('foods.json', JSON.stringify(formattedFoods, null, 2));
  console.log(`Successfully wrote ${formattedFoods.length} foods to foods.json!`);
}

generateJson();

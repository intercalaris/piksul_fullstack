const uploadInput = document.getElementById('upload');
const snapButton = document.getElementById('snapButton');
const downloadButton = document.getElementById('downloadButton');
const gridSizeInput = document.getElementById('gridSizeInput');
const toleranceInput = document.getElementById('toleranceInput');
const controls = document.getElementById('controls');
const divisor = document.getElementById('divisor');
const slider = document.getElementById('slider');
const comparison = document.getElementById('comparison');
const startProjectButton = document.getElementById('startProjectButton');
const saveProjectButton = document.getElementById('saveProjectButton');
const openProjectButtons = document.querySelectorAll('.open-project');
const deleteProjectButtons = document.querySelectorAll('.delete-project');
const viewSavedProjectsButton = document.getElementById('viewSavedProjectsButton');

let originalImage = null;
let snappedImageURL = null;
let originalFileName = ''; 
let estimatedGridSize = 8;
let estimatedTolerance = 30;



uploadInput?.addEventListener('change', (event) => {
    const file = event.target.files[0];

    // Reset UI elements and state for new image
    snappedImageURL = null;
    divisor.style.backgroundImage = ''; // Clear previous snapped image
    downloadButton.style.display = 'none'; // Hide download button until new snapping is done

    const img = new Image();
    console.log('new image')
    img.onload = () => {
        comparison.style.aspectRatio = `${img.width} / ${img.height}`;
        // Set original image as background of comparison container (left side)
        const originalImageURL = URL.createObjectURL(file);
        document.querySelector('#comparison figure').style.backgroundImage = `url(${originalImageURL})`;
        originalFileName = file.name.split('.').slice(0, -1).join('.'); // Extract name without extension after last "."

        // Get user tolerance value
        const userTolerance = parseInt(toleranceInput.value, 10) || estimatedTolerance;

        // Estimate grid size using that tolerance value
        estimatedGridSize = estimateGridSize(img, userTolerance);

        // Update UI inputs with estimated values
        gridSizeInput.value = estimatedGridSize;
        toleranceInput.value = userTolerance;

        // Show the snap button, controls, and comparison after the image load
        snapButton.style.display = 'inline-block';
        controls.style.display = 'block';
        comparison.style.display = 'block';

        console.log("Image loaded successfully.");
    };
    img.src = URL.createObjectURL(file);
});


snapButton?.addEventListener('click', () => {
    console.log("Snap to Grid button clicked.");
    const userGridSize = parseInt(gridSizeInput.value, 10) || estimatedGridSize;
    const userTolerance = parseInt(toleranceInput.value, 10) || estimatedTolerance;

    console.log("User-provided tolerance value for snapping:", userTolerance);

    // Create snapped version of image
    snapToGrid(userGridSize, userTolerance);
});

downloadButton?.addEventListener('click', () => {
    if (snappedImageURL) {
        const link = document.createElement('a');
        link.href = snappedImageURL;
        link.download = `piksul_${originalFileName}.png`;
        link.click();
    }
});


slider?.addEventListener('input', () =>  {
    divisor.style.width = slider.value + "%";
});


function estimateGridSize(img, tolerance) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    let colorChanges = [];

    // Analyze horizontal and vertical lines to estimate grid size
    for (let y = 0; y < height; y++) {
        let prevColor = [data[y * width * 4], data[y * width * 4 + 1], data[y * width * 4 + 2]];
        let count = 1;
        for (let x = 1; x < width; x++) {
            const index = (y * width + x) * 4;
            const currentColor = [data[index], data[index + 1], data[index + 2]];
            if (colorsAreDifferent(prevColor, currentColor, tolerance)) {
                if (count > 1) {
                    colorChanges.push(count);
                }
                count = 1;
            } else {
                count++;
            }
            prevColor = currentColor;
        }
    }

    for (let x = 0; x < width; x++) {
        let prevColor = [data[x * 4], data[x * 4 + 1], data[x * 4 + 2]];
        let count = 1;
        for (let y = 1; y < height; y++) {
            const index = (y * width + x) * 4;
            const currentColor = [data[index], data[index + 1], data[index + 2]];
            if (colorsAreDifferent(prevColor, currentColor, tolerance)) {
                if (count > 1) {
                    colorChanges.push(count);
                }
                count = 1;
            } else {
                count++;
            }
            prevColor = currentColor;
        }
    }

    console.log(`Total color changes: ${colorChanges.length}`);

    // Sort color changes to evaluate thresholds
    colorChanges.sort((a, b) => a - b);
    const percentile75Index = Math.floor(0.75 * colorChanges.length);
    const lengthThreshold = colorChanges[percentile75Index];

    // Filter using the 75th percentile to remove larger homogeneous regions
    const filteredChanges = colorChanges.filter(value => value <= lengthThreshold);

    console.log(`Filtered color changes count: ${filteredChanges.length}`);
    console.log(`Sample of filtered changes (first 20): ${filteredChanges.slice(0, 20).join(', ')}`);

    // Calculate the frequency of each grid size in filteredChanges
    const frequencyMap = {};
    filteredChanges.forEach(value => {
        frequencyMap[value] = (frequencyMap[value] || 0) + 1;
    });

    const sortedFrequencies = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]);

    console.log(
        `Top 10 most frequent run lengths: ${sortedFrequencies.slice(0, 10).map(([value, freq]) => `${value}: ${freq}`).join(', ')}` 
    );

    // Generate images for top 3 grid size candidates and select the best visually
    const topCandidates = sortedFrequencies.slice(0, 3).map(([value]) => parseInt(value));
    const evaluationScores = topCandidates.map(candidateSize => {
        return evaluateSnapping(img, candidateSize, tolerance);
    });

    const bestCandidateIndex = evaluationScores.indexOf(Math.min(...evaluationScores));
    const finalGridSize = topCandidates[bestCandidateIndex];

    console.log(`Estimated grid size: ${finalGridSize}`);
    return finalGridSize;
}

function evaluateSnapping(img, gridSize, tolerance) {
    console.log(`Evaluating snapping quality for grid size: ${gridSize}`);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    let totalDeviation = 0;

    // Loop through each grid cell
    for (let y = 0; y < height; y += gridSize) {
        for (let x = 0; x < width; x += gridSize) {
            const centerX = Math.min(x + Math.floor(gridSize / 2), width - 1);
            const centerY = Math.min(y + Math.floor(gridSize / 2), height - 1);
            const index = (centerY * width + centerX) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            let cellDeviation = 0;
            let cellPixelCount = 0;

            let colorSumR = 0, colorSumG = 0, colorSumB = 0;
            let colorValues = [];

            // Calculate deviation for each pixel in the grid cell from the sampled color
            for (let offsetY = 0; offsetY < gridSize; offsetY++) {
                for (let offsetX = 0; offsetX < gridSize; offsetX++) {
                    const pixelX = x + offsetX;
                    const pixelY = y + offsetY;
                    if (pixelX < width && pixelY < height) {
                        const newIndex = (pixelY * width + pixelX) * 4;
                        const dr = data[newIndex] - r;
                        const dg = data[newIndex + 1] - g;
                        const db = data[newIndex + 2] - b;
                        cellDeviation += Math.abs(dr) + Math.abs(dg) + Math.abs(db);
                        cellPixelCount++;

                        // Calculate color statistics for weight calculation
                        colorSumR += data[newIndex];
                        colorSumG += data[newIndex + 1];
                        colorSumB += data[newIndex + 2];
                        colorValues.push([data[newIndex], data[newIndex + 1], data[newIndex + 2]]);
                    }
                }
            }

            // Calculate mean color for the cell
            const meanR = colorSumR / cellPixelCount;
            const meanG = colorSumG / cellPixelCount;
            const meanB = colorSumB / cellPixelCount;

            // Calculate standard deviation (or variance) of colors in the cell
            let colorVariance = 0;
            for (let i = 0; i < colorValues.length; i++) {
                const [rVal, gVal, bVal] = colorValues[i];
                colorVariance += Math.pow(rVal - meanR, 2) + Math.pow(gVal - meanG, 2) + Math.pow(bVal - meanB, 2);
            }
            colorVariance /= cellPixelCount;

            // Apply a stronger non-linear transformation to create significant differences
            const contrastWeight = 1 + Math.pow(colorVariance, 2);

            // Apply weight to cell deviation
            if (cellPixelCount > 0) {
                cellDeviation /= cellPixelCount;
            }
            totalDeviation += cellDeviation * contrastWeight;
        }
    }

    console.log(`Total deviation for grid size ${gridSize}: ${totalDeviation}`);
    return totalDeviation;
}

function colorsAreDifferent(color1, color2, tolerance) {
    return (
        Math.abs(color1[0] - color2[0]) > tolerance ||
        Math.abs(color1[1] - color2[1]) > tolerance ||
        Math.abs(color1[2] - color2[2]) > tolerance
    );
}

function snapToGrid(gridSize, tolerance) {
    console.log("Snapping to grid with size: " + gridSize);
    console.log("Using tolerance value:", tolerance);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions to match original image
    const img = new Image();
    img.src = document.querySelector('#comparison figure').style.backgroundImage.slice(5, -2); // Remove 'url("")'

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // Snap to grid
        for (let y = 0; y < height; y += gridSize) {
            for (let x = 0; x < width; x += gridSize) {
                // Sample color from central pixel of current grid cell
                const centerX = Math.min(x + Math.floor(gridSize / 2), width - 1);
                const centerY = Math.min(y + Math.floor(gridSize / 2), height - 1);
                const index = (centerY * width + centerX) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3];

                // Set all pixels in grid cell to sampled color
                for (let offsetY = 0; offsetY < gridSize; offsetY++) {
                    for (let offsetX = 0; offsetX < gridSize; offsetX++) {
                        const pixelX = x + offsetX;
                        const pixelY = y + offsetY;
                        if (pixelX < width && pixelY < height) {
                            const newIndex = (pixelY * width + pixelX) * 4;
                            data[newIndex] = r;
                            data[newIndex + 1] = g;
                            data[newIndex + 2] = b;
                            data[newIndex + 3] = a;
                        }
                    }
                }
            }
        }

        // Put modified data back to canvas
        ctx.putImageData(imageData, 0, 0);

        // Convert canvas to data URL and set the snapped image URL
        snappedImageURL = canvas.toDataURL('image/png');
        console.log("Snapping complete.");

        // Update divisor to show snapped image without moving
        divisor.style.backgroundImage = `url(${snappedImageURL})`;

        // Use the exact dimensions of the comparison container
        const comparisonRect = comparison.getBoundingClientRect();
        divisor.style.backgroundSize = `${comparisonRect.width}px ${comparisonRect.height}px`;
        divisor.style.backgroundRepeat = "no-repeat";
        divisor.style.backgroundPosition = "top left";

        // Show download and save project buttons
        downloadButton.style.display = 'inline-block';
        saveProjectButton.style.display = 'inline-block';
    };
}

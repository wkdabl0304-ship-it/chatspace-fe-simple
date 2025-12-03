<script>
	import { getApiUrl } from '$lib/config.js';
	import { authToken, isLoggedIn, initAuth } from '$lib/auth.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import '../../lib/styles/wechat-theme.css';

	/** @type {HTMLInputElement} */
	let fileInput;
	/** @type {File | null} */
	let selectedFile = null;
	let previewUrl = '';
	let uploading = false;
	let message = '';
	
	// 裁剪相关状态
	let showCropper = false;
	/** @type {HTMLCanvasElement | null} */
	let cropperCanvas = null;
	/** @type {HTMLCanvasElement | null} */
	let previewCanvas = null;
	/** @type {HTMLImageElement | null} */
	let cropperImage = null;
	let cropData = {
		x: 0,
		y: 0,
		size: 200,
		scale: 1
	};
	let isDragging = false;
	let dragStart = { x: 0, y: 0 };
	
	// 长按缩放相关状态
	let isScaling = false;
	let scaleDirection = 0; // -1 缩小, 1 放大
	/** @type {NodeJS.Timeout | null} */
	let scaleInterval = null;
	let scaleStartTime = 0;
	
	// 单击/长按区分
	/** @type {NodeJS.Timeout | null} */
	let clickTimer = null;
	let isLongPress = false;

	// 响应式获取token和登录状态
	$: token = $authToken;
	$: loggedIn = $isLoggedIn;

	onMount(async () => {
		// 初始化认证状态
		initAuth();
		
		// 等待一小段时间让认证状态初始化完成
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// 直接从localStorage检查token，不依赖store
		const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
		
		// 检查登录状态，如果未登录则跳转到登录页面
		if (!token) {
			message = '请先登录后再上传头像';
			setTimeout(() => {
				goto('/login');
			}, 2000);
		}
	});
	
	// 单独的清理函数
	onMount(() => {
		return () => {
			if (typeof stopScaling === 'function') stopScaling();
			if (clickTimer) {
				clearTimeout(clickTimer);
				clickTimer = null;
			}
		};
	});

	/**
	 * @param {Event & { currentTarget: EventTarget & HTMLInputElement }} event
	 */
	function handleFileSelect(event) {
		const target = /** @type {HTMLInputElement} */ (event.target);
		if (!target || !target.files) return;
		const file = target.files[0];
		if (!file) return;

		// 检查文件类型
		const supportedTypes = ['image/webp', 'image/jpeg', 'image/jpg', 'image/png'];
		if (!supportedTypes.includes(file.type)) {
			message = '只支持webp、jpg/jpeg、png格式的图片';
			return;
		}

		// 检查文件大小 (5MB)
		if (file.size > 5 * 1024 * 1024) {
			message = '文件大小不能超过5MB';
			return;
		}

		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
		message = '';
		
		// 显示裁剪器
		showCropper = true;
		initCropper(file);
	}

	async function uploadAvatar() {
		if (!selectedFile || !loggedIn) {
			message = '请先选择文件并登录';
			return;
		}

		uploading = true;
		message = '';

		try {
			let fileToUpload = selectedFile;
			
			// 如果在裁剪模式，先进行裁剪
			if (showCropper) {
				message = '正在裁剪图片...';
				fileToUpload = await cropImage();
				} else if (selectedFile.type !== 'image/webp') {
				// 如果不是webp格式，先转换
				message = '正在处理...';
				fileToUpload = await convertToWebp(selectedFile);
			}

			message = '正在上传...';
			const formData = new FormData();
			formData.append('file', fileToUpload);

			const response = await fetch(getApiUrl('/api/file/avatar'), {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`
				},
				body: formData
			});

			if (response.ok) {
				message = '头像上传成功！';
				// 清空选择和裁剪状态
				selectedFile = null;
				previewUrl = '';
				showCropper = false;
				if (fileInput) fileInput.value = '';
				
				// 延迟1秒后返回聊天页面
				setTimeout(() => {
					goto('/chat');
				}, 1000);
			} else {
				const errorData = await response.text();
				message = `上传失败: ${errorData}`;
			}
		} catch (/** @type {any} */ error) {
			message = `上传失败: ${error.message}`;
		} finally {
			uploading = false;
		}
	}

	/**
	 * 初始化裁剪器
	 * @param {File} file 图片文件
	 */
	function initCropper(file) {
		const img = new Image();
		img.onload = () => {
			cropperImage = img;
			
			// 计算图片在容器中的显示尺寸（保持原始比例）
			const containerSize = 300; // 裁剪容器大小
			const imgAspect = img.width / img.height;
			
			let displayWidth, displayHeight;
			
			if (imgAspect > 1) {
				// 横图：以容器宽度为准
				displayWidth = containerSize;
				displayHeight = containerSize / imgAspect;
				cropData.scale = containerSize / img.width;
			} else {
				// 竖图：以容器高度为准
				displayHeight = containerSize;
				displayWidth = containerSize * imgAspect;
				cropData.scale = containerSize / img.height;
			}
			
			// 图片居中显示
			cropData.x = (containerSize - displayWidth) / 2;
			cropData.y = (containerSize - displayHeight) / 2;
			
			// 圆形裁剪区域大小（根据图片尺寸智能计算）
			const maxCircleSize = Math.min(displayWidth, displayHeight) * 0.8;
			const defaultCircleSize = Math.min(displayWidth, displayHeight) * 0.6;
			cropData.size = Math.min(maxCircleSize, Math.max(defaultCircleSize, 150));
			
			// 确保初始状态圆形在图片内
			adjustImageToKeepCircleInside();
			
			// 确保初始缩放略大于最小缩放，让用户可以缩小
			const minScale = cropData.size / Math.max(cropperImage.width, cropperImage.height);
			if (cropData.scale <= minScale + 0.01) {
				cropData.scale = minScale + 0.05; // 给一些缩小空间
				// 重新调整位置
				adjustImageToKeepCircleInside();
			}
			
			drawCropper();
		};
		img.src = URL.createObjectURL(file);
	}

	/**
	 * 绘制裁剪器
	 */
	function drawCropper() {
		if (!cropperCanvas || !cropperImage) return;
		
		const ctx = cropperCanvas.getContext('2d');
		if (!ctx) return;
		
		const containerSize = 300;
		
		// 清空画布
		ctx.clearRect(0, 0, containerSize, containerSize);
		
		// 绘制图片（保持原始比例）
		const imgWidth = cropperImage.width * cropData.scale;
		const imgHeight = cropperImage.height * cropData.scale;
		
		ctx.drawImage(
			cropperImage,
			cropData.x,
			cropData.y,
			imgWidth,
			imgHeight
		);
		
		// 绘制遮罩（除了圆形区域）
		ctx.save();
		ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.fillRect(0, 0, containerSize, containerSize);
		
		// 创建圆形透明区域
		ctx.globalCompositeOperation = 'destination-out';
		ctx.beginPath();
		ctx.arc(containerSize / 2, containerSize / 2, cropData.size / 2, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		
		// 绘制圆形边框
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(containerSize / 2, containerSize / 2, cropData.size / 2, 0, Math.PI * 2);
		ctx.stroke();
		
		// 更新预览
		updatePreview();
	}

	/**
	 * 检查圆形区域是否完全在图片内
	 * @returns {boolean} 是否在图片内
	 */
	function isCircleWithinImage() {
		if (!cropperImage) return false;
		
		const containerSize = 300;
		const centerX = containerSize / 2;
		const centerY = containerSize / 2;
		const radius = cropData.size / 2;
		
		// 计算图片边界
		const imgWidth = cropperImage.width * cropData.scale;
		const imgHeight = cropperImage.height * cropData.scale;
		const imgLeft = cropData.x;
		const imgTop = cropData.y;
		const imgRight = cropData.x + imgWidth;
		const imgBottom = cropData.y + imgHeight;
		
		// 检查圆形是否完全在图片内
		const circleLeft = centerX - radius;
		const circleTop = centerY - radius;
		const circleRight = centerX + radius;
		const circleBottom = centerY + radius;
		
		return circleLeft >= imgLeft && 
			   circleTop >= imgTop && 
			   circleRight <= imgRight && 
			   circleBottom <= imgBottom;
	}

	/**
	 * 调整图片位置确保圆形区域在图片内
	 */
	function adjustImageToKeepCircleInside() {
		if (!cropperImage) return;
		
		const containerSize = 300;
		const centerX = containerSize / 2;
		const centerY = containerSize / 2;
		const radius = cropData.size / 2;
		
		const imgWidth = cropperImage.width * cropData.scale;
		const imgHeight = cropperImage.height * cropData.scale;
		
		// 计算圆形边界
		const circleLeft = centerX - radius;
		const circleTop = centerY - radius;
		const circleRight = centerX + radius;
		const circleBottom = centerY + radius;
		
		// 调整图片位置确保圆形在图片内
		if (circleLeft < cropData.x) {
			cropData.x = circleLeft;
		}
		if (circleTop < cropData.y) {
			cropData.y = circleTop;
		}
		if (circleRight > cropData.x + imgWidth) {
			cropData.x = circleRight - imgWidth;
		}
		if (circleBottom > cropData.y + imgHeight) {
			cropData.y = circleBottom - imgHeight;
		}
	}

	/**
	 * 更新圆形预览
	 */
	function updatePreview() {
		if (!previewCanvas || !cropperImage) return;
		
		const ctx = previewCanvas.getContext('2d');
		if (!ctx) return;
		
		const previewSize = 120;
		
		// 清空预览画布
		ctx.clearRect(0, 0, previewSize, previewSize);
		
		// 计算裁剪区域在原图中的位置
		const containerSize = 300;
		const centerX = containerSize / 2;
		const centerY = containerSize / 2;
		const radius = cropData.size / 2;
		
		// 计算原图中的裁剪区域
		const sourceX = (centerX - radius - cropData.x) / cropData.scale;
		const sourceY = (centerY - radius - cropData.y) / cropData.scale;
		const sourceSize = cropData.size / cropData.scale;
		
		// 创建圆形裁剪路径
		ctx.save();
		ctx.beginPath();
		ctx.arc(previewSize / 2, previewSize / 2, previewSize / 2, 0, Math.PI * 2);
		ctx.clip();
		
		// 绘制裁剪后的图片
		ctx.drawImage(
			cropperImage,
			sourceX,
			sourceY,
			sourceSize,
			sourceSize,
			0,
			0,
			previewSize,
			previewSize
		);
		
		ctx.restore();
	}

	/**
	 * 处理鼠标按下事件
	 * @param {MouseEvent} e
	 */
	function handleMouseDown(e) {
		if (!cropperCanvas) return;
		isDragging = true;
		const rect = cropperCanvas.getBoundingClientRect();
		dragStart.x = e.clientX - rect.left - cropData.x;
		dragStart.y = e.clientY - rect.top - cropData.y;
	}

	/**
	 * 处理鼠标移动事件
	 * @param {MouseEvent} e
	 */
	function handleMouseMove(e) {
		if (!isDragging || !cropperCanvas) return;
		
		const rect = cropperCanvas.getBoundingClientRect();
		const newX = e.clientX - rect.left - dragStart.x;
		const newY = e.clientY - rect.top - dragStart.y;
		
		// 限制拖拽范围，确保圆形区域始终在图片内
		const containerSize = 300;
		if (!cropperImage) return;
		const imgWidth = cropperImage.width * cropData.scale;
		const imgHeight = cropperImage.height * cropData.scale;
		
		const centerX = containerSize / 2;
		const centerY = containerSize / 2;
		const radius = cropData.size / 2;
		
		// 计算拖拽边界，确保圆形完全在图片内
		// 图片左边界不能超过圆形左边界
		const maxX = centerX - radius;
		// 图片右边界不能小于圆形右边界
		const minX = centerX + radius - imgWidth;
		// 图片上边界不能超过圆形上边界
		const maxY = centerY - radius;
		// 图片下边界不能小于圆形下边界
		const minY = centerY + radius - imgHeight;
		
		cropData.x = Math.max(Math.min(newX, maxX), minX);
		cropData.y = Math.max(Math.min(newY, maxY), minY);
		
		drawCropper();
	}

	/**
	 * 处理鼠标释放事件
	 */
	function handleMouseUp() {
		isDragging = false;
	}

	/**
	 * 计算最小缩放值（确保图片能完全覆盖圆形区域）
	 * @returns {number} 最小缩放值
	 */
	function getMinScale() {
		if (!cropperImage) return 0.1;
		
		// 计算让图片能完全覆盖圆形所需的最小缩放
		// 图片的宽度和高度都必须大于等于圆形直径
		const scaleForWidth = cropData.size / cropperImage.width;
		const scaleForHeight = cropData.size / cropperImage.height;
		
		// 取较大的缩放值，确保图片的两个维度都能覆盖圆形
		// 这样圆形就不会超出图片范围，也不会有空白
		return Math.max(scaleForWidth, scaleForHeight);
	}

	/**
	 * 处理缩放
	 * @param {number} delta 缩放增量
	 */
	function handleScale(delta) {
		if (!cropperImage) return;
		
		const minScale = getMinScale();
		const maxScale = 5;
		const newScale = Math.max(minScale, Math.min(maxScale, cropData.scale + delta));
		const oldScale = cropData.scale;
		cropData.scale = newScale;
		
		// 计算缩放后的图片尺寸
		const oldImgWidth = cropperImage.width * oldScale;
		const oldImgHeight = cropperImage.height * oldScale;
		const newImgWidth = cropperImage.width * newScale;
		const newImgHeight = cropperImage.height * newScale;
		
		// 以圆形中心为缩放中心调整位置
		const containerSize = 300;
		const centerX = containerSize / 2;
		const centerY = containerSize / 2;
		
		// 计算图片中心相对于圆形中心的偏移
		const oldImgCenterX = cropData.x + oldImgWidth / 2;
		const oldImgCenterY = cropData.y + oldImgHeight / 2;
		const offsetX = oldImgCenterX - centerX;
		const offsetY = oldImgCenterY - centerY;
		
		// 按比例调整偏移
		const scaleRatio = newScale / oldScale;
		const newOffsetX = offsetX * scaleRatio;
		const newOffsetY = offsetY * scaleRatio;
		
		// 计算新的图片位置
		cropData.x = centerX + newOffsetX - newImgWidth / 2;
		cropData.y = centerY + newOffsetY - newImgHeight / 2;
		
		// 如果达到最小缩放，特殊处理居中
		if (Math.abs(cropData.scale - minScale) < 0.01) {
			// 当图片缩放到最小时，让图片居中显示
			const containerSize = 300;
			const centerX = containerSize / 2;
			const centerY = containerSize / 2;
			
			cropData.x = centerX - newImgWidth / 2;
			cropData.y = centerY - newImgHeight / 2;
		} else {
			// 调整位置确保圆形在图片内
			adjustImageToKeepCircleInside();
		}
		
		drawCropper();
	}

	/**
	 * 开始长按缩放
	 * @param {number} direction 缩放方向 (-1 缩小, 1 放大)
	 */
	function startScaling(direction) {
		if (isScaling) return;
		
		isScaling = true;
		scaleDirection = direction;
		scaleStartTime = Date.now();
		
		// 立即执行一次缩放
		const initialDelta = direction * 0.01;
		handleScale(initialDelta);
		
		// 设置定时器持续缩放
		scaleInterval = setInterval(() => {
			if (!isScaling) return;
			
			// 计算动态缩放速度（长按时间越长，速度越快）
			const elapsed = Date.now() - scaleStartTime;
			let speed = 0.01; // 再次降低初始速度
			
			if (elapsed > 2000) {
				speed = 0.02; // 2秒后轻微加速
			}
			if (elapsed > 5000) {
				speed = 0.03; // 5秒后再次轻微加速
			}
			
			const delta = scaleDirection * speed;
			
			// 检查是否达到边界
			const minScale = getMinScale();
			const maxScale = 5;
			
			if ((scaleDirection < 0 && cropData.scale <= minScale + 0.005) ||
				(scaleDirection > 0 && cropData.scale >= maxScale - 0.005)) {
				stopScaling();
				return;
			}
			
			handleScale(delta);
		}, 80); // 每80ms执行一次，降低频率
	}

	/**
	 * 停止长按缩放
	 */
	function stopScaling() {
		if (!isScaling) return;
		
		isScaling = false;
		scaleDirection = 0;
		
		if (scaleInterval) {
			clearInterval(scaleInterval);
			scaleInterval = null;
		}
	}

	/**
	 * 单击缩放（精细调整1%）
	 * @param {number} direction 缩放方向
	 */
	function handleSingleClick(direction) {
		const delta = direction * 0.01; // 1%的精细调整
		handleScale(delta);
	}

	/**
	 * 处理鼠标按下事件（缩放按钮）
	 * @param {number} direction 缩放方向
	 */
	function handleScaleMouseDown(direction) {
		isLongPress = false;
		
		// 设置长按检测定时器（300ms后认为是长按）
		clickTimer = setTimeout(() => {
			isLongPress = true;
			startScaling(direction);
		}, 300);
	}

	/**
	 * 处理鼠标释放事件（缩放按钮）
	 * @param {number} direction 缩放方向
	 * @param {boolean} isActualClick 是否是真正的点击释放
	 */
	function handleScaleMouseUp(direction, isActualClick = true) {
		// 清除长按检测定时器
		if (clickTimer) {
			clearTimeout(clickTimer);
			clickTimer = null;
		}
		
		if (isLongPress) {
			// 长按：停止连续缩放
			stopScaling();
		} else if (isActualClick) {
			// 只有在真正的点击释放时才执行精细调整
			handleSingleClick(direction);
		}
		
		isLongPress = false;
	}

	/**
	 * 处理鼠标离开事件（缩放按钮）
	 * @param {number} direction 缩放方向
	 */
	function handleScaleMouseLeave(direction) {
		// 鼠标离开时只清理状态，不执行单击操作
		handleScaleMouseUp(direction, false);
	}

	/**
	 * 裁剪图片并返回正方形结果
	 * @returns {Promise<File>} 裁剪后的图片文件
	 */
	async function cropImage() {
		if (!cropperImage) throw new Error('没有图片可裁剪');
		
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('无法创建canvas上下文');
		
		// 设置输出尺寸为正方形
		const outputSize = 400;
		canvas.width = outputSize;
		canvas.height = outputSize;
		
		// 计算裁剪区域在原图中的位置
		const containerSize = 300;
		const centerX = containerSize / 2;
		const centerY = containerSize / 2;
		const radius = cropData.size / 2;
		
		// 计算原图中的裁剪区域
		const sourceX = (centerX - radius - cropData.x) / cropData.scale;
		const sourceY = (centerY - radius - cropData.y) / cropData.scale;
		const sourceSize = (cropData.size) / cropData.scale;
		
		// 绘制裁剪后的图片
		ctx.drawImage(
			cropperImage,
			sourceX,
			sourceY,
			sourceSize,
			sourceSize,
			0,
			0,
			outputSize,
			outputSize
		);
		
		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) {
					const croppedFile = new File(
						[blob],
						selectedFile?.name.replace(/\.(jpg|jpeg|png|webp)$/i, '_cropped.webp') || 'cropped.webp',
						{ type: 'image/webp' }
					);
					resolve(croppedFile);
				} else {
					reject(new Error('图片裁剪失败'));
				}
			}, 'image/webp', 0.9);
		});
	}


	/**
	 * 取消裁剪
	 */
	function cancelCrop() {
		showCropper = false;
		selectedFile = null;
		previewUrl = '';
		message = '';
		if (fileInput) fileInput.value = '';
	}

	/**
	 * 将图片转换为webp格式
	 * @param {File} file 原始图片文件
	 * @param {number} quality webp质量 (0-1)
	 * @returns {Promise<File>} 转换后的webp文件
	 */
	async function convertToWebp(file, quality = 0.9) {
		return new Promise((resolve, reject) => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const img = new Image();

			img.onload = () => {
				// API要求正方形图片，所以我们需要裁剪成正方形
				const size = Math.min(img.width, img.height);
				const outputSize = 400; // 输出400x400的正方形
				
				canvas.width = outputSize;
				canvas.height = outputSize;

				// 计算居中裁剪的位置
				const sourceX = (img.width - size) / 2;
				const sourceY = (img.height - size) / 2;

				// 绘制正方形裁剪的图片到canvas
				ctx?.drawImage(
					img,
					sourceX, sourceY, size, size,  // 源图片的正方形区域
					0, 0, outputSize, outputSize   // 目标canvas的全部区域
				);

				// 转换为webp格式
				canvas.toBlob((blob) => {
					if (blob) {
						// 创建新的File对象
						const webpFile = new File(
							[blob], 
							file.name.replace(/\.(jpg|jpeg|png)$/i, '.webp'), 
							{ type: 'image/webp' }
						);
						resolve(webpFile);
					} else {
						reject(new Error('图片转换失败'));
					}
				}, 'image/webp', quality);
			};

			img.onerror = () => {
				reject(new Error('图片加载失败'));
			};

			img.src = URL.createObjectURL(file);
		});
	}

	function clearSelection() {
		selectedFile = null;
		previewUrl = '';
		message = '';
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="wechat-container">
	<!-- 现代化头部 -->
	<header class="wechat-header">
		<div class="header-left">
			<button 
				class="wechat-btn wechat-btn-ghost"
				on:click={() => goto('/chat')}
				style="padding: 8px 12px; min-height: auto;"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="m15 18-6-6 6-6"/>
				</svg>
				返回
			</button>
		</div>
		<h1 class="wechat-header-title">头像上传</h1>
		<div class="header-right">
			<!-- 登录状态指示 -->
			{#if loggedIn}
				<div class="status-indicator success">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
						<polyline points="22,4 12,14.01 9,11.01"/>
					</svg>
				</div>
			{:else}
				<div class="status-indicator error">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<line x1="15" y1="9" x2="9" y2="15"/>
						<line x1="9" y1="9" x2="15" y2="15"/>
					</svg>
				</div>
			{/if}
		</div>
	</header>

	<div class="avatar-content">
		<!-- 文件选择卡片 -->
		{#if !selectedFile}
			<div class="wechat-card upload-card">
				<div class="card-header">
					<div class="card-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
							<polyline points="7,10 12,15 17,10"/>
							<line x1="12" y1="15" x2="12" y2="3"/>
						</svg>
					</div>
					<h3>选择头像文件</h3>
				</div>
				<div class="upload-area">
					<input 
						id="avatar-file"
						type="file" 
						accept=".webp,.jpg,.jpeg,.png"
						bind:this={fileInput}
						on:change={handleFileSelect}
						class="file-input"
					/>
					<label for="avatar-file" class="file-upload-label">
						<div class="upload-icon">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
								<polyline points="17,8 12,3 7,8"/>
								<line x1="12" y1="3" x2="12" y2="15"/>
							</svg>
						</div>
						<div class="upload-text">
							<p class="upload-title">选择头像图片</p>
							<p class="upload-subtitle">支持常见图片格式</p>
						</div>
					</label>
				</div>
			</div>
		{/if}

		<!-- 图片裁剪器 -->
		{#if showCropper}
			<div class="wechat-card cropper-card">
				<div class="card-header">
					<div class="card-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
							<circle cx="12" cy="7" r="4"/>
						</svg>
					</div>
					<h3>调整头像</h3>
					<div class="scale-indicator">
						{#if cropperImage}
							{Math.round(cropData.scale * 100)}%
						{/if}
					</div>
				</div>
				<div class="cropper-workspace">
					<div class="cropper-main">
						<canvas
							bind:this={cropperCanvas}
							width="300"
							height="300"
							class="cropper-canvas"
							on:mousedown={handleMouseDown}
							on:mousemove={handleMouseMove}
							on:mouseup={handleMouseUp}
							on:mouseleave={handleMouseUp}
						></canvas>
						<div class="cropper-hint">
							<p>拖拽调整位置</p>
						</div>
					</div>
					<div class="cropper-sidebar">
						<div class="preview-section">
							<h4>预览效果</h4>
							<div class="preview-circle">
								<canvas
									bind:this={previewCanvas}
									width="120"
									height="120"
									class="preview-canvas"
								></canvas>
							</div>
						</div>
						<div class="scale-controls">
							<h4>缩放控制</h4>
							<div class="scale-buttons">
								<button 
									type="button" 
									class="wechat-btn wechat-btn-secondary scale-btn" 
									class:scaling={isScaling && scaleDirection < 0}
									on:mousedown={() => handleScaleMouseDown(-1)}
									on:mouseup={() => handleScaleMouseUp(-1)}
									on:mouseleave={() => handleScaleMouseLeave(-1)}
									on:touchstart={() => handleScaleMouseDown(-1)}
									on:touchend={() => handleScaleMouseUp(-1)}
									aria-label="缩小"
									disabled={cropperImage && cropData.scale <= getMinScale() + 0.005}
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="11" cy="11" r="8"/>
										<path d="M21 21l-4.35-4.35"/>
										<line x1="8" y1="11" x2="14" y2="11"/>
									</svg>
									缩小
								</button>
								<button 
									type="button" 
									class="wechat-btn wechat-btn-secondary scale-btn" 
									class:scaling={isScaling && scaleDirection > 0}
									on:mousedown={() => handleScaleMouseDown(1)}
									on:mouseup={() => handleScaleMouseUp(1)}
									on:mouseleave={() => handleScaleMouseLeave(1)}
									on:touchstart={() => handleScaleMouseDown(1)}
									on:touchend={() => handleScaleMouseUp(1)}
									aria-label="放大"
									disabled={cropData.scale >= 5}
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="11" cy="11" r="8"/>
										<path d="M21 21l-4.35-4.35"/>
										<line x1="11" y1="8" x2="11" y2="14"/>
										<line x1="8" y1="11" x2="14" y2="11"/>
									</svg>
									放大
								</button>
							</div>
							<p class="scale-tip">单击微调，长按缩放</p>
						</div>
					</div>
				</div>
				<div class="cropper-actions">
					<button type="button" class="wechat-btn wechat-btn-ghost" on:click={cancelCrop}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"/>
							<line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
						取消
					</button>
					<button 
						type="button" 
						class="wechat-btn wechat-btn-primary" 
						on:click={uploadAvatar}
						disabled={uploading || !loggedIn}
					>
						{#if uploading}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
								<path d="M21 12a9 9 0 11-6.219-8.56"/>
							</svg>
							上传中...
						{:else}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
								<polyline points="7,10 12,15 17,10"/>
								<line x1="12" y1="15" x2="12" y2="3"/>
							</svg>
							上传
						{/if}
					</button>
				</div>
			</div>
		{/if}

		<!-- 预览和上传区域 -->
		{#if selectedFile && !showCropper}
			<div class="wechat-card preview-card">
				<div class="card-header">
					<div class="card-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
							<polyline points="7,10 12,15 17,10"/>
							<line x1="12" y1="15" x2="12" y2="3"/>
						</svg>
					</div>
					<h3>预览与上传</h3>
				</div>
				<div class="preview-content">
					<div class="preview-image-container">
						<img src={previewUrl} alt="头像预览" class="preview-image" />
					</div>
					<div class="file-info">
						<div class="info-item">
							<span class="info-label">已选择</span>
							<span class="info-value">{selectedFile.name}</span>
						</div>
						<div class="info-item">
							<span class="info-label">大小</span>
							<span class="info-value">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
						</div>
					</div>
				</div>
				<div class="upload-actions">
					<button class="wechat-btn wechat-btn-ghost" on:click={clearSelection}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 6h18"/>
							<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
							<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
						</svg>
						清空选择
					</button>
					<button 
						class="wechat-btn wechat-btn-primary upload-btn" 
						on:click={uploadAvatar} 
						disabled={uploading || !loggedIn}
					>
						{#if uploading}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
								<path d="M21 12a9 9 0 11-6.219-8.56"/>
							</svg>
							上传中...
						{:else}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
								<polyline points="7,10 12,15 17,10"/>
								<line x1="12" y1="15" x2="12" y2="3"/>
							</svg>
							上传
						{/if}
					</button>
				</div>
			</div>
		{/if}

		<!-- 消息提示 -->
		{#if message}
			<div class="message-card" class:success={message.includes('成功')} class:error={message.includes('失败') || message.includes('错误')}>
				<div class="message-icon">
					{#if message.includes('成功')}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M22 11.08V12a10 10 0 11-6.219-8.56"/>
							<polyline points="22,4 12,14.01 9,11.01"/>
						</svg>
					{:else}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"/>
							<line x1="15" y1="9" x2="9" y2="15"/>
							<line x1="9" y1="9" x2="15" y2="15"/>
						</svg>
					{/if}
				</div>
				<p>{message}</p>
			</div>
		{/if}
	</div>
</div>

<style>
	/* 头部样式 */
	.header-left {
		display: flex;
		align-items: center;
	}

	.header-right {
		display: flex;
		align-items: center;
	}

	.status-indicator {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-indicator.success {
		background: rgba(7, 193, 96, 0.1);
		color: var(--wechat-green);
	}

	.status-indicator.error {
		background: rgba(255, 77, 79, 0.1);
		color: #ff4d4f;
	}

	/* 主要内容区域 */
	.avatar-content {
		padding: var(--wechat-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--wechat-space-xl);
		max-width: 800px;
		margin: 0 auto;
	}

	/* 卡片头部样式 */
	.card-header {
		display: flex;
		align-items: center;
		gap: var(--wechat-space-md);
		padding: var(--wechat-space-xl);
		border-bottom: 1px solid var(--wechat-border);
	}

	.card-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--wechat-radius-md);
		background: rgba(7, 193, 96, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--wechat-green);
	}

	.card-header h3 {
		color: var(--wechat-text-primary);
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		flex: 1;
	}

	.scale-indicator {
		background: var(--wechat-bg-tertiary);
		color: var(--wechat-text-secondary);
		padding: var(--wechat-space-xs) var(--wechat-space-sm);
		border-radius: var(--wechat-radius-sm);
		font-size: 12px;
		font-weight: 500;
	}

	/* 上传区域样式 */
	.upload-area {
		padding: var(--wechat-space-xl);
	}

	.file-input {
		display: none;
	}

	.file-upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--wechat-space-lg);
		padding: var(--wechat-space-2xl);
		border: 2px dashed var(--wechat-border);
		border-radius: var(--wechat-radius-lg);
		cursor: pointer;
		transition: all 0.3s ease;
		background: var(--wechat-bg-tertiary);
	}

	.file-upload-label:hover {
		border-color: var(--wechat-green);
		background: var(--wechat-bg-hover);
	}

	.upload-icon {
		color: var(--wechat-text-secondary);
		transition: color 0.3s ease;
	}

	.file-upload-label:hover .upload-icon {
		color: var(--wechat-green);
	}

	.upload-text {
		text-align: center;
	}

	.upload-title {
		color: var(--wechat-text-primary);
		font-size: 16px;
		font-weight: 500;
		margin: 0 0 var(--wechat-space-xs) 0;
	}

	.upload-subtitle {
		color: var(--wechat-text-secondary);
		font-size: 14px;
		margin: 0;
	}

	/* 裁剪器样式 */
	.cropper-workspace {
		display: flex;
		gap: var(--wechat-space-xl);
		padding: var(--wechat-space-xl);
	}

	.cropper-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--wechat-space-md);
	}

	.cropper-canvas {
		border: 2px solid var(--wechat-border);
		border-radius: var(--wechat-radius-lg);
		cursor: move;
		background: var(--wechat-bg-tertiary);
	}

	.cropper-hint {
		text-align: center;
	}

	.cropper-hint p {
		color: var(--wechat-text-secondary);
		font-size: 14px;
		margin: 0;
	}

	.cropper-sidebar {
		width: 200px;
		display: flex;
		flex-direction: column;
		gap: var(--wechat-space-lg);
	}

	.preview-section h4,
	.scale-controls h4 {
		color: var(--wechat-text-primary);
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 var(--wechat-space-sm) 0;
	}

	.preview-circle {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--wechat-border);
		background: var(--wechat-bg-tertiary);
		margin: 0 auto;
	}

	.preview-canvas {
		border-radius: 50%;
	}

	.scale-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--wechat-space-sm);
	}

	.scale-btn.scaling {
		background: var(--wechat-green-hover) !important;
		animation: scaling-pulse 0.8s ease-in-out infinite alternate;
	}

	@keyframes scaling-pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(7, 193, 96, 0.7);
		}
		100% {
			box-shadow: 0 0 0 8px rgba(7, 193, 96, 0);
		}
	}

	.scale-tip {
		color: var(--wechat-text-tertiary);
		font-size: 12px;
		margin: var(--wechat-space-sm) 0 0 0;
		text-align: center;
	}

	.cropper-actions {
		display: flex;
		justify-content: center;
		gap: var(--wechat-space-md);
		padding: var(--wechat-space-xl);
		border-top: 1px solid var(--wechat-border);
	}

	/* 预览卡片样式 */
	.preview-content {
		display: flex;
		gap: var(--wechat-space-xl);
		padding: var(--wechat-space-xl);
	}

	.preview-image-container {
		flex-shrink: 0;
	}

	.preview-image {
		width: 120px;
		height: 120px;
		object-fit: cover;
		border-radius: var(--wechat-radius-md);
		border: 2px solid var(--wechat-border);
	}

	.file-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--wechat-space-sm);
	}

	.info-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--wechat-space-sm) 0;
		border-bottom: 1px solid var(--wechat-border-light);
	}

	.info-item:last-child {
		border-bottom: none;
	}

	.info-label {
		color: var(--wechat-text-secondary);
		font-size: 14px;
	}

	.info-value {
		color: var(--wechat-text-primary);
		font-size: 14px;
		font-weight: 500;
	}


	.upload-actions {
		display: flex;
		justify-content: center;
		gap: var(--wechat-space-md);
		padding: var(--wechat-space-xl);
		border-top: 1px solid var(--wechat-border);
	}

	/* 消息卡片样式 */
	.message-card {
		display: flex;
		align-items: center;
		gap: var(--wechat-space-md);
		padding: var(--wechat-space-lg);
		border-radius: var(--wechat-radius-lg);
		border: 1px solid;
		margin: 0 var(--wechat-space-xl);
	}

	.message-card.success {
		background: rgba(7, 193, 96, 0.1);
		border-color: var(--wechat-green);
		color: var(--wechat-green);
	}

	.message-card.error {
		background: rgba(255, 77, 79, 0.1);
		border-color: #ff4d4f;
		color: #ff4d4f;
	}

	.message-icon {
		flex-shrink: 0;
	}

	.message-card p {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
	}

	/* 动画 */
	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* 响应式设计 */
	@media (max-width: 768px) {
		.avatar-content {
			padding: var(--wechat-space-md);
			gap: var(--wechat-space-md);
		}

		.cropper-workspace {
			flex-direction: column;
			gap: var(--wechat-space-md);
		}

		.cropper-sidebar {
			width: 100%;
		}

		.preview-content {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}

		.file-info {
			width: 100%;
		}

		.upload-actions,

		.cropper-actions {
			order: 2;
			width: 100%;
			justify-content: center;
		}
	}
</style>
